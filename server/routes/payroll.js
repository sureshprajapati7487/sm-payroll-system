// ── PAYROLL + LOANS + LEAVES + PRODUCTION ROUTES ──────────────────────────────
const express = require('express');
const router = express.Router();

let Leave, Loan, SalarySlip, Employee, Attendance, Production, AdvanceSalary, Holiday, addError, getErrorHint;

function init(models) {
    Leave = models.Leave;
    Loan = models.Loan;
    SalarySlip = models.SalarySlip;
    Employee = models.Employee;
    Attendance = models.Attendance;
    Production = models.Production;
    AdvanceSalary = models.AdvanceSalary;
    Holiday = models.Holiday;
    addError = models.addError;
    getErrorHint = models.getErrorHint;
}

// ── Leaves ────────────────────────────────────────────────────────────────────
router.get('/leaves', async (req, res) => {
    const { employeeId, status } = req.query;
    try {
        const where = {};
        // Use req.companyId from JWT (enforced by requireCompanyScope)
        if (req.companyId) where.companyId = req.companyId;
        if (employeeId) where.employeeId = employeeId;
        if (status) where.status = status;
        res.json(await Leave.findAll({ where, order: [['appliedOn', 'DESC']] }));
    } catch (e) { addError(e, 'GET /api/leaves'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.post('/leaves', async (req, res) => {
    try {
        const payload = { ...req.body };
        if (!payload.daysCount && payload.startDate && payload.endDate) {
            if (payload.isHalfDay) {
                payload.daysCount = 0.5;
            } else {
                const s = new Date(payload.startDate);
                const e = new Date(payload.endDate);
                payload.daysCount = Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 24)) + 1;
            }
        }
        res.json(await Leave.create(payload));
    }
    catch (e) { addError(e, 'POST /api/leaves'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

router.patch('/leaves/:id/approve', async (req, res) => {
    try {
        const leave = await Leave.findByPk(req.params.id);
        if (!leave) return res.status(404).json({ error: 'Leave not found' });
        if (leave.status === 'APPROVED') return res.json(leave);

        leave.status = 'APPROVED';
        await leave.save();

        if (leave.type !== 'UNPAID') {
            const emp = await Employee.findByPk(leave.employeeId);
            if (emp && emp.leaveBalance && emp.leaveBalance[leave.type] !== undefined) {
                emp.leaveBalance[leave.type] -= (leave.daysCount || 1);
                emp.changed('leaveBalance', true);
                await emp.save();
            }
        }
        res.json(leave);
    } catch (e) {
        if (e.name === 'SequelizeOptimisticLockError') {
            return res.status(409).json({ error: 'Review failed: Another user concurrently modified this leave request. Please refresh and try again.' });
        }
        addError(e, 'PATCH /api/leaves/:id/approve'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix });
    }
});

router.patch('/leaves/:id/reject', async (req, res) => {
    try {
        const leave = await Leave.findByPk(req.params.id);
        if (!leave) return res.status(404).json({ error: 'Leave not found' });

        const wasApproved = leave.status === 'APPROVED';
        leave.status = 'REJECTED';
        await leave.save();

        if (wasApproved && leave.type !== 'UNPAID') {
            const emp = await Employee.findByPk(leave.employeeId);
            if (emp && emp.leaveBalance && emp.leaveBalance[leave.type] !== undefined) {
                emp.leaveBalance[leave.type] += (leave.daysCount || 1);
                emp.changed('leaveBalance', true);
                await emp.save();
            }
        }
        res.json(leave);
    } catch (e) {
        if (e.name === 'SequelizeOptimisticLockError') {
            return res.status(409).json({ error: 'Review failed: Another user concurrently modified this leave request. Please refresh and try again.' });
        }
        addError(e, 'PATCH /api/leaves/:id/reject'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix });
    }
});

router.put('/leaves/:id', async (req, res) => {
    try {
        await Leave.update(req.body, { where: { id: req.params.id } });
        res.json(await Leave.findByPk(req.params.id));
    } catch (e) {
        if (e.name === 'SequelizeOptimisticLockError') {
            return res.status(409).json({ error: 'Update failed: Record was modified by another user. Please refresh and try again.' });
        }
        addError(e, 'PUT /api/leaves/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix });
    }
});

router.delete('/leaves/:id', async (req, res) => {
    try {
        const leave = await Leave.findByPk(req.params.id);
        if (leave && leave.status === 'APPROVED' && leave.type !== 'UNPAID') {
            const emp = await Employee.findByPk(leave.employeeId);
            if (emp && emp.leaveBalance && emp.leaveBalance[leave.type] !== undefined) {
                emp.leaveBalance[leave.type] += (leave.daysCount || 1);
                emp.changed('leaveBalance', true);
                await emp.save();
            }
        }
        await Leave.destroy({ where: { id: req.params.id } }); res.json({ success: true });
    }
    catch (e) { addError(e, 'DELETE /api/leaves/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// ── Loans ─────────────────────────────────────────────────────────────────────
router.get('/loans', async (req, res) => {
    const { employeeId, status } = req.query;
    try {
        const where = {};
        // Use req.companyId from JWT (enforced by requireCompanyScope)
        if (req.companyId) where.companyId = req.companyId;
        if (employeeId) where.employeeId = employeeId;
        if (status) where.status = status;
        res.json(await Loan.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/loans'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.post('/loans', async (req, res) => {
    try { res.json(await Loan.create(req.body)); }
    catch (e) { addError(e, 'POST /api/loans'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.put('/loans/:id', async (req, res) => {
    try { await Loan.update(req.body, { where: { id: req.params.id } }); res.json({ success: true }); }
    catch (e) { addError(e, 'PUT /api/loans/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

router.patch('/loans/:id/approve', async (req, res) => {
    try {
        const loan = await Loan.findByPk(req.params.id);
        if (!loan) return res.status(404).json({ error: 'Not found' });
        if (loan.status === 'ACTIVE') return res.json(loan);

        loan.status = 'ACTIVE';
        loan.issuedDate = req.body.issuedDate || new Date().toISOString().split('T')[0];

        const newLedgerEntry = {
            id: Math.random().toString(36).substr(2, 9),
            date: loan.issuedDate,
            amount: loan.amount,
            type: 'ADVANCE_PAYMENT',
            remarks: 'Loan Approved & Issued'
        };
        loan.ledger = [...(loan.ledger || []), newLedgerEntry];
        loan.changed('ledger', true);

        // Push Audit Trail
        const auditEntry = {
            id: Math.random().toString(36).substr(2, 9),
            date: new Date().toISOString(),
            action: 'APPROVED',
            performedBy: req.body.performedBy || 'System',
            details: 'Loan Approved'
        };
        loan.auditTrail = [...(loan.auditTrail || []), auditEntry];
        loan.changed('auditTrail', true);

        await loan.save();
        res.json(loan);
    } catch (e) { addError(e, 'PATCH /api/loans/:id/approve'); res.status(500).json({ error: e.message }); }
});

router.patch('/loans/:id/reject', async (req, res) => {
    try {
        const loan = await Loan.findByPk(req.params.id);
        if (!loan) return res.status(404).json({ error: 'Not found' });
        loan.status = 'REJECTED';

        const auditEntry = {
            id: Math.random().toString(36).substr(2, 9),
            date: new Date().toISOString(),
            action: 'REJECTED',
            performedBy: req.body.performedBy || 'System',
            details: 'Loan Rejected'
        };
        loan.auditTrail = [...(loan.auditTrail || []), auditEntry];
        loan.changed('auditTrail', true);

        await loan.save();
        res.json(loan);
    } catch (e) { addError(e, 'PATCH /api/loans/:id/reject'); res.status(500).json({ error: e.message }); }
});

router.post('/loans/:id/pay', async (req, res) => {
    try {
        const { amount } = req.body;
        const loan = await Loan.findByPk(req.params.id);
        if (!loan) return res.status(404).json({ error: 'Not found' });

        const newBal = Math.max(0, loan.balance - amount);
        loan.balance = newBal;
        if (newBal <= 0) loan.status = 'CLOSED';

        const newLedgerEntry = {
            id: Math.random().toString(36).substr(2, 9),
            date: new Date().toISOString().split('T')[0],
            amount: amount,
            type: 'EMI',
            remarks: 'Manual Payment'
        };
        loan.ledger = [...(loan.ledger || []), newLedgerEntry];
        loan.changed('ledger', true);

        await loan.save();
        res.json(loan);
    } catch (e) { addError(e, 'POST /api/loans/:id/pay'); res.status(500).json({ error: e.message }); }
});

// ── Payroll ───────────────────────────────────────────────────────────────────
router.get('/payroll', async (req, res) => {
    const { month, employeeId } = req.query;
    try {
        const where = {};
        // Use req.companyId from JWT (enforced by requireCompanyScope)
        if (req.companyId) where.companyId = req.companyId;
        if (month) where.month = month;
        if (employeeId) where.employeeId = employeeId;
        res.json(await SalarySlip.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/payroll'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.post('/payroll', async (req, res) => {
    try { const slip = await SalarySlip.upsert(req.body); res.json(slip); }
    catch (e) { addError(e, 'POST /api/payroll'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.get('/payroll/:id', async (req, res) => {
    try {
        const slip = await SalarySlip.findOne({ where: { id: req.params.id } });
        if (!slip) return res.status(404).json({ error: 'Salary slip not found' });
        res.json(slip);
    } catch (e) { addError(e, 'GET /api/payroll/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.put('/payroll/:id', async (req, res) => {
    try { await SalarySlip.update(req.body, { where: { id: req.params.id } }); res.json({ success: true }); }
    catch (e) { addError(e, 'PUT /api/payroll/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// ── 🚀 BULK SECURE RUN ────────────────────────────────────────────────────────
const Decimal = require('decimal.js');

router.post('/run', async (req, res) => {
    const { companyId, month, generatedBy } = req.body;
    if (!companyId || !month) return res.status(400).json({ error: 'companyId and month required' });

    const sequelize = Employee.sequelize; // Get sequelize instance from any model
    const t = await sequelize.transaction();

    try {
        // 1. Fetch raw data
        const [employees, allRecords, allProds, allLoans, allAdvances, holidaysList, statutoryRules] = await Promise.all([
            Employee.findAll({ where: { companyId, status: 'ACTIVE' } }),
            Attendance.findAll({ where: { companyId } }),
            Production.findAll({ where: { companyId, status: 'APPROVED' } }),
            Loan.findAll({ where: { companyId, status: 'ACTIVE' } }),
            AdvanceSalary.findAll({ where: { companyId, status: 'approved' } }),
            Holiday.findAll({ where: { companyId } }),
            StatutoryRule.findAll({ where: { companyId }, order: [['effectiveDate', 'DESC']] })
        ]);

        const year = Number(month.split('-')[0]);
        const monthNum = Number(month.split('-')[1]);
        const daysInMonth = new Date(year, monthNum, 0).getDate();
        const monthEndDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

        // Find the applicable statutory rule (first rule where effectiveDate <= month end date)
        const activeStatutoryRule = statutoryRules.find(r => r.effectiveDate <= monthEndDate) || null;

        // Very basic config defaults
        const config = {
            enableZeroPresenceRule: true,
            enableSandwichRule: true,
            enableLateMarksPenalty: false, lateMarksThreshold: 3, lateMarksPenaltyType: 'HALF_DAY',
            enableEarlyGoPenalty: false, earlyGoPenaltyType: 'HALF_DAY',
            enableNightShiftAllowance: false, nightShiftStartHour: 22, nightShiftEndHour: 6, nightShiftAllowanceAmount: 200,
            enableOTMinThreshold: false, otMinThresholdMinutes: 30,
            enableOTCap: false, otCapHoursPerMonth: 50,
            enableOTMultipliers: true, otNormalMultiplier: 1.5,
            enableEMICap: true, emiCapPercentage: 50,
            enableAttendanceBonus: false, attendanceBonusAmount: 1000
        };

        const generatedSlips = [];

        for (const emp of employees) {
            // Filter
            const empRecords = allRecords.filter(r => r.employeeId === emp.id && r.date.startsWith(month));
            const empProds = allProds.filter(p => p.employeeId === emp.id && p.date.startsWith(month));
            const empLoans = allLoans.filter(l => l.employeeId === emp.id);
            const empAdvances = allAdvances.filter(a => a.employeeId === emp.id && a.remainingBalance > 0);

            let normalWorkedDays = 0, normalHalfDays = 0;
            let holidayBaseDays = 0, offDayWorkedDays = 0, offDayHalfDays = 0;
            let presentDaysForStats = 0, overtimeHours = 0, totalWorkedDaysForRule = 0;
            let lateMarksCount = 0, earlyGoCount = 0, nightShiftDays = 0;
            let isPerfectAttendance = true;

            const checkIsOffDay = (dateStr) => {
                const dObj = new Date(dateStr + 'T12:00:00Z');
                return dObj.getUTCDay() === 0 || holidaysList.some(h => h.date === dateStr);
            };
            const checkIsPresent = (dateStr) => empRecords.some(r => r.date === dateStr && ['PRESENT', 'LATE', 'HALF_DAY'].includes(r.status));

            // Loop Days
            for (let i = 1; i <= daysInMonth; i++) {
                const date = `${month}-${String(i).padStart(2, '0')}`;
                const record = empRecords.find(r => r.date === date);
                const isOffDay = checkIsOffDay(date);

                if (record) {
                    if (['PRESENT', 'LATE', 'HALF_DAY'].includes(record.status)) {
                        if (record.status === 'HALF_DAY') presentDaysForStats += 0.5; else presentDaysForStats += 1;
                    }

                    if (['PRESENT', 'LATE'].includes(record.status)) {
                        if (!isOffDay) normalWorkedDays++; else offDayWorkedDays++;
                        totalWorkedDaysForRule++;
                        if (record.status === 'LATE') lateMarksCount++;
                    } else if (record.status === 'HALF_DAY') {
                        if (!isOffDay) normalHalfDays++; else offDayHalfDays++;
                        totalWorkedDaysForRule += 0.5;
                        isPerfectAttendance = false;
                    } else if (record.status === 'ABSENT') {
                        isPerfectAttendance = false;
                    }

                    if (record.checkIn && config.enableNightShiftAllowance) {
                        const hr = new Date(record.checkIn).getHours();
                        if (hr >= config.nightShiftStartHour || hr < config.nightShiftEndHour) nightShiftDays++;
                    }
                    overtimeHours += record.overtimeHours || 0;
                } else if (!isOffDay) {
                    isPerfectAttendance = false;
                }

                if (emp.salaryType === 'MONTHLY' && isOffDay) {
                    let isPaid = true;
                    if (config.enableSandwichRule) {
                        let prevStr = '', nextStr = '';
                        for (let d = i - 1; d >= 1; d--) { const td = `${month}-${String(d).padStart(2, '0')}`; if (!checkIsOffDay(td)) { prevStr = td; break; } }
                        for (let d = i + 1; d <= daysInMonth; d++) { const td = `${month}-${String(d).padStart(2, '0')}`; if (!checkIsOffDay(td)) { nextStr = td; break; } }
                        const pOk = prevStr ? checkIsPresent(prevStr) : true;
                        const nOk = nextStr ? checkIsPresent(nextStr) : true;

                        if (pOk && nOk) isPaid = true;
                        else if (!pOk && !nOk) isPaid = false;
                        else {
                            let anyOk = false, daysChkd = 0, scan = i - 1;
                            while (daysChkd < 6 && scan >= 1) {
                                const dStr = `${month}-${String(scan).padStart(2, '0')}`;
                                if (!checkIsOffDay(dStr)) { if (checkIsPresent(dStr)) { anyOk = true; break; } daysChkd++; }
                                scan--;
                            }
                            isPaid = anyOk;
                        }
                    }
                    if (isPaid) holidayBaseDays++;
                }
            }

            if (config.enableZeroPresenceRule && totalWorkedDaysForRule === 0) {
                holidayBaseDays = 0; presentDaysForStats = 0;
            }

            const basePaidDaysD = new Decimal(normalWorkedDays).plus(new Decimal(normalHalfDays).times(0.5)).plus(holidayBaseDays);
            const basePaidDays = Math.max(0, basePaidDaysD.toNumber());

            const otBonusDaysD = new Decimal(offDayWorkedDays).plus(new Decimal(offDayHalfDays).times(0.5));
            const otBonusDays = otBonusDaysD.toNumber();

            let basicEarnings = new Decimal(0);
            let overtimeEarnings = new Decimal(0);

            if (emp.salaryType === 'MONTHLY') {
                const basicSalaryD = new Decimal(emp.basicSalary || 0);
                const pdr = basicSalaryD.dividedBy(daysInMonth);

                basicEarnings = pdr.times(new Decimal(basePaidDays).plus(otBonusDays)).round();

                let effOT = new Decimal(overtimeHours);
                if (config.enableOTCap && effOT.greaterThan(config.otCapHoursPerMonth)) {
                    effOT = new Decimal(config.otCapHoursPerMonth);
                }
                const hrRate = basicSalaryD.dividedBy(30).dividedBy(9);
                overtimeEarnings = hrRate.times(effOT).times(config.otNormalMultiplier).round();

            } else if (emp.salaryType === 'DAILY') {
                const rt = new Decimal(emp.paymentRate || 0);
                basicEarnings = rt.times(new Decimal(basePaidDays).plus(otBonusDays)).round();
                overtimeEarnings = rt.dividedBy(9).times(overtimeHours).round();

            } else if (emp.salaryType === 'HOURLY') {
                const rt = new Decimal(emp.paymentRate || 0);
                basicEarnings = rt.times(new Decimal(basePaidDays).plus(otBonusDays)).times(9).round();
                overtimeEarnings = rt.times(overtimeHours).round();
            }

            const productionEarnings = empProds.reduce((sum, p) => sum.plus(p.totalAmount || 0), new Decimal(0)).round();

            const nightAllow = config.enableNightShiftAllowance ? new Decimal(nightShiftDays).times(config.nightShiftAllowanceAmount) : new Decimal(0);
            const attBonus = (config.enableAttendanceBonus && isPerfectAttendance && totalWorkedDaysForRule > 0) ? new Decimal(config.attendanceBonusAmount) : new Decimal(0);
            const totalAllowances = nightAllow.plus(attBonus).round();

            const grossSalary = basicEarnings.plus(productionEarnings).plus(overtimeEarnings).plus(totalAllowances).round();

            // Statutory Calc
            const sc = emp.statutoryConfig || {};
            let pfD = new Decimal(0);
            let esicD = new Decimal(0);
            let ptD = new Decimal(0);
            let tdsD = new Decimal(0);

            // Inherit dynamic rates based on active rule or defaults
            const dynPfRate = activeStatutoryRule ? activeStatutoryRule.pfRate : (sc.pfRate || 12);
            const dynPfCap = activeStatutoryRule ? activeStatutoryRule.pfCappedAmount : 1800;
            const dynEsicRate = activeStatutoryRule ? activeStatutoryRule.esicRate : (sc.esicRate || 0.75);
            const dynEsicThreshold = activeStatutoryRule ? activeStatutoryRule.esicThreshold : 21000;

            if (sc.pfApplicable) {
                const b = new Decimal(emp.basicSalary || 0);
                const r = b.times(new Decimal(dynPfRate).dividedBy(100)).round();
                if (sc.pfCapped ?? true) {
                    pfD = Decimal.min(r, dynPfCap);
                } else {
                    pfD = r;
                }
            }
            if (sc.esicApplicable && grossSalary.lessThanOrEqualTo(dynEsicThreshold)) {
                esicD = grossSalary.times(new Decimal(dynEsicRate).dividedBy(100)).round();
            }
            if (sc.ptApplicable) {
                if (sc.ptAmount !== undefined) {
                    ptD = new Decimal(sc.ptAmount);
                } else {
                    const gVal = grossSalary.toNumber();
                    // Resolve PT slabs dynamic or fallback to simple hardcoded structure
                    if (activeStatutoryRule && activeStatutoryRule.ptSlabs && activeStatutoryRule.ptSlabs.length > 0) {
                        const slabs = [...activeStatutoryRule.ptSlabs].sort((a, b) => b.min - a.min);
                        const matchedSlab = slabs.find(s => gVal >= s.min && (s.max === null || gVal <= s.max));
                        if (matchedSlab) ptD = new Decimal(matchedSlab.tax);
                    } else {
                        if (gVal > 15000) ptD = new Decimal(200);
                        else if (gVal > 10000) ptD = new Decimal(150);
                        else if (gVal > 7500) ptD = new Decimal(100);
                    }
                }
            }

            // Simplified TDS
            tdsD = new Decimal(0); // Will calculate based on rules if needed, zero mock for now
            const tdsDeduction = tdsD.toNumber();
            const pfDeduction = pfD.toNumber();

            const otherDeduction = ptD.plus(esicD).round();

            // ── EMI CARRY FORWARD CAP ────────────────────────────────────────────────
            const availableSalaryForDeductions = Decimal.max(0, grossSalary.minus(pfD).minus(tdsD).minus(otherDeduction));

            let loanDeduction = new Decimal(0);
            empLoans.forEach(l => {
                if (l.balance > 0) {
                    loanDeduction = loanDeduction.plus(Decimal.min(l.emiAmount || 0, l.balance || 0));
                }
            });

            if (config.enableEMICap) {
                const cap = grossSalary.times(config.emiCapPercentage).dividedBy(100);
                if (loanDeduction.greaterThan(cap)) {
                    loanDeduction = cap.round();
                }
            }

            if (loanDeduction.greaterThan(availableSalaryForDeductions)) {
                loanDeduction = availableSalaryForDeductions;
            }
            const remainingSalaryForAdvance = Decimal.max(0, availableSalaryForDeductions.minus(loanDeduction));

            let advanceDeduction = empAdvances.reduce((sum, a) => sum.plus(Decimal.min(a.monthlyDeduction || 0, a.remainingBalance || 0)), new Decimal(0));

            if (config.enableEMICap) {
                const cap = grossSalary.times(config.emiCapPercentage).dividedBy(100);
                if (loanDeduction.plus(advanceDeduction).greaterThan(cap)) {
                    advanceDeduction = Decimal.max(0, cap.minus(loanDeduction)).round();
                }
            }

            if (advanceDeduction.greaterThan(remainingSalaryForAdvance)) {
                advanceDeduction = remainingSalaryForAdvance;
            }

            const loanD = loanDeduction.round();
            const advD = advanceDeduction.round();
            const totalDeductions = loanD.plus(advD).plus(pfD).plus(tdsD).plus(otherDeduction).round();
            const netSalary = grossSalary.minus(totalDeductions).round();

            generatedSlips.push({
                id: Math.random().toString(36).substr(2, 9),
                companyId,
                employeeId: emp.id,
                month,
                totalDays: daysInMonth,
                presentDays: presentDaysForStats,
                paidLeaveDays: 0,
                absentDays: daysInMonth - presentDaysForStats,
                basicSalary: basicEarnings.toNumber(),
                productionAmount: productionEarnings.toNumber(),
                overtimeAmount: overtimeEarnings.toNumber(),
                allowances: totalAllowances.toNumber(),
                grossSalary: grossSalary.toNumber(),
                loanDeduction: loanD.toNumber(),
                advanceDeduction: advD.toNumber(),
                pfDeduction: pfD.toNumber(),
                taxDeduction: tdsD.toNumber(),
                otherDeduction: otherDeduction.toNumber(),
                totalDeductions: totalDeductions.toNumber(),
                netSalary: netSalary.toNumber(),
                status: 'DRAFT', // NEW STATE MACHINE START
                generatedOn: new Date().toISOString(),
                generatedBy: generatedBy || 'Server Sync'
            });
        }

        // Wipe old DRAFT slips for this month
        await SalarySlip.destroy({
            where: { companyId, month, status: 'DRAFT' },
            transaction: t
        });

        // Save new slips
        await SalarySlip.bulkCreate(generatedSlips, { transaction: t });

        // COMMIT transaction
        await t.commit();

        res.json({ success: true, count: generatedSlips.length });
    } catch (e) {
        // ROLLBACK transaction
        await t.rollback();
        addError(e, 'POST /api/payroll/run');
        const h = getErrorHint(e);
        res.status(500).json({ error: e.message, why: h.why, fix: h.fix });
    }
});

// ── PAYROLL STATE MACHINE ───────────────────────────────────────────────────────
router.patch('/:id/simulate', async (req, res) => {
    try {
        const slip = await SalarySlip.findByPk(req.params.id);
        if (!slip) return res.status(404).json({ error: 'Not found' });
        if (slip.status !== 'DRAFT') return res.status(400).json({ error: 'Only DRAFT can be SIMULATED' });

        slip.status = 'SIMULATION';
        await slip.save();
        res.json(slip);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/approve', async (req, res) => {
    try {
        const slip = await SalarySlip.findByPk(req.params.id);
        if (!slip) return res.status(404).json({ error: 'Not found' });
        if (slip.status !== 'SIMULATION') return res.status(400).json({ error: 'Only SIMULATED slips can be APPROVED' });

        slip.status = 'FINAL_APPROVED';
        await slip.save();
        res.json(slip);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/lock', async (req, res) => {
    try {
        const slip = await SalarySlip.findByPk(req.params.id);
        if (!slip) return res.status(404).json({ error: 'Not found' });
        if (slip.status !== 'FINAL_APPROVED') return res.status(400).json({ error: 'Only FINAL_APPROVED slips can be LOCKED' });

        slip.status = 'LOCKED';
        await slip.save();

        // Push to Audit Log that this month's payroll is locked for this employee
        // In a real scenario, you'd also hit AdvanceSalary and Loan ledgers to finalize deductions here.

        res.json(slip);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = { router, init };
