/**
 * payrollWorker.js — Payroll computation worker thread
 *
 * Spawned by POST /api/run. Receives { jobId, companyId, month, generatedBy }
 * via workerData, performs the full payroll calculation, and writes results to DB.
 * Reports progress and final status via ReportJob table so the frontend can poll.
 */
'use strict';
const { workerData } = require('worker_threads');
const Decimal = require('decimal.js');
const {
    sequelize, Employee, Attendance, Production, Loan, AdvanceSalary, Holiday,
    StatutoryRule, SystemSetting, SalarySlip, ReportJob,
} = require('../database');

async function runPayroll() {
    const { jobId, companyId, month, generatedBy } = workerData;

    // Update job to PROCESSING
    await ReportJob.update({ status: 'PROCESSING', progress: 5 }, { where: { id: jobId } });

    const t = await sequelize.transaction();

    try {
        const [employees, allRecords, allProds, allLoans, allAdvances, holidaysList, statutoryRules, payrollConfigSetting] = await Promise.all([
            Employee.findAll({ where: { companyId, status: 'ACTIVE' } }),
            Attendance.findAll({ where: { companyId } }),
            Production.findAll({ where: { companyId, status: 'APPROVED' } }),
            Loan.findAll({ where: { companyId, status: 'ACTIVE' } }),
            AdvanceSalary.findAll({ where: { companyId, status: 'approved' } }),
            Holiday.findAll({ where: { companyId } }),
            StatutoryRule.findAll({ where: { companyId }, order: [['effectiveDate', 'DESC']] }),
            SystemSetting.findOne({ where: { companyId, key: 'PAYROLL_CONFIG' } }),
        ]);

        await ReportJob.update({ progress: 20 }, { where: { id: jobId } });

        const year = Number(month.split('-')[0]);
        const monthNum = Number(month.split('-')[1]);
        const daysInMonth = new Date(year, monthNum, 0).getDate();
        const monthEndDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

        const activeStatutoryRule = statutoryRules.find(r => r.effectiveDate <= monthEndDate) || null;

        const configDefaults = {
            enableZeroPresenceRule: true, enableSandwichRule: true,
            enableLateMarksPenalty: false, lateMarksThreshold: 3, lateMarksPenaltyType: 'HALF_DAY',
            enableEarlyGoPenalty: false, earlyGoPenaltyType: 'HALF_DAY',
            enableNightShiftAllowance: false, nightShiftStartHour: 22, nightShiftEndHour: 6, nightShiftAllowanceAmount: 200,
            enableOTMinThreshold: false, otMinThresholdMinutes: 30,
            enableOTCap: false, otCapHoursPerMonth: 50,
            enableOTMultipliers: true, otNormalMultiplier: 1.5,
            enableEMICap: true, emiCapPercentage: 50,
            enableAttendanceBonus: false, attendanceBonusAmount: 1000,
        };
        let savedConfig = {};
        if (payrollConfigSetting?.value) {
            try { savedConfig = JSON.parse(payrollConfigSetting.value); } catch { /* use defaults */ }
        }
        const config = { ...configDefaults, ...savedConfig };

        const generatedSlips = [];
        const loanBalanceUpdates = [];
        const perEmployeeErrors = [];

        for (const emp of employees) {
            try {
                const empRecords = allRecords.filter(r => r.employeeId === emp.id && r.date.startsWith(month));
                const empProds = allProds.filter(p => p.employeeId === emp.id && p.date.startsWith(month));
                const empLoans = allLoans.filter(l => l.employeeId === emp.id);
                const empAdvances = allAdvances.filter(a => a.employeeId === emp.id && a.remainingBalance > 0);

                let normalWorkedDays = 0, normalHalfDays = 0;
                let holidayBaseDays = 0, offDayWorkedDays = 0, offDayHalfDays = 0;
                let presentDaysForStats = 0, overtimeHours = 0, totalWorkedDaysForRule = 0;
                let lateMarksCount = 0, nightShiftDays = 0;
                let isPerfectAttendance = true;

                const checkIsOffDay = (dateStr) => {
                    const dObj = new Date(dateStr + 'T12:00:00Z');
                    return dObj.getUTCDay() === 0 || holidaysList.some(h => h.date === dateStr);
                };
                const checkIsPresent = (dateStr) => empRecords.some(r => r.date === dateStr && ['PRESENT', 'LATE', 'HALF_DAY'].includes(r.status));

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

                const basePaidDays = Math.max(0, new Decimal(normalWorkedDays).plus(new Decimal(normalHalfDays).times(0.5)).plus(holidayBaseDays).toNumber());
                const otBonusDays = new Decimal(offDayWorkedDays).plus(new Decimal(offDayHalfDays).times(0.5)).toNumber();

                let basicEarnings = new Decimal(0);
                let overtimeEarnings = new Decimal(0);

                if (emp.salaryType === 'MONTHLY') {
                    const basicSalaryD = new Decimal(emp.basicSalary || 0);
                    const pdr = basicSalaryD.dividedBy(daysInMonth);
                    basicEarnings = pdr.times(new Decimal(basePaidDays).plus(otBonusDays)).round();
                    let effOT = new Decimal(overtimeHours);
                    if (config.enableOTCap && effOT.greaterThan(config.otCapHoursPerMonth)) effOT = new Decimal(config.otCapHoursPerMonth);
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

                const sc = emp.statutoryConfig || {};
                let pfD = new Decimal(0), esicD = new Decimal(0), ptD = new Decimal(0), tdsD = new Decimal(0);

                const dynPfRate = activeStatutoryRule ? activeStatutoryRule.pfRate : (sc.pfRate || 12);
                const dynPfCap = activeStatutoryRule ? activeStatutoryRule.pfCappedAmount : 1800;
                const dynEsicRate = activeStatutoryRule ? activeStatutoryRule.esicRate : (sc.esicRate || 0.75);
                const dynEsicThreshold = activeStatutoryRule ? activeStatutoryRule.esicThreshold : 21000;

                if (sc.pfApplicable) {
                    const b = new Decimal(emp.basicSalary || 0);
                    const r = b.times(new Decimal(dynPfRate).dividedBy(100)).round();
                    pfD = (sc.pfCapped ?? true) ? Decimal.min(r, dynPfCap) : r;
                }
                if (sc.esicApplicable && grossSalary.lessThanOrEqualTo(dynEsicThreshold)) {
                    esicD = grossSalary.times(new Decimal(dynEsicRate).dividedBy(100)).round();
                }
                if (sc.ptApplicable) {
                    if (sc.ptAmount !== undefined) {
                        ptD = new Decimal(sc.ptAmount);
                    } else {
                        const gVal = grossSalary.toNumber();
                        if (activeStatutoryRule?.ptSlabs?.length > 0) {
                            const slabs = [...activeStatutoryRule.ptSlabs].sort((a, b) => b.min - a.min);
                            const matched = slabs.find(s => gVal >= s.min && (s.max === null || gVal <= s.max));
                            if (matched) ptD = new Decimal(matched.tax);
                        } else {
                            if (gVal > 15000) ptD = new Decimal(200);
                            else if (gVal > 10000) ptD = new Decimal(150);
                            else if (gVal > 7500) ptD = new Decimal(100);
                        }
                    }
                }

                if (sc.tdsApplicable) {
                    const gVal = grossSalary.toNumber();
                    if (sc.tdsPercentage !== undefined) {
                        tdsD = grossSalary.times(sc.tdsPercentage).dividedBy(100).round();
                    } else if (!sc.tdsPanLinked) {
                        tdsD = grossSalary.times(20).dividedBy(100).round();
                    } else {
                        const annualGross = gVal * 12;
                        const regime = emp.taxRegime || 'NEW';
                        let annualTax = 0;
                        if (regime === 'NEW') {
                            if (annualGross <= 300000) annualTax = 0;
                            else if (annualGross <= 700000) annualTax = (annualGross - 300000) * 0.05;
                            else if (annualGross <= 1000000) annualTax = 20000 + (annualGross - 700000) * 0.10;
                            else if (annualGross <= 1200000) annualTax = 50000 + (annualGross - 1000000) * 0.15;
                            else if (annualGross <= 1500000) annualTax = 80000 + (annualGross - 1200000) * 0.20;
                            else annualTax = 140000 + (annualGross - 1500000) * 0.30;
                            if (annualGross <= 700000) annualTax = 0;
                        } else {
                            const stdDeduction = 50000;
                            // tdsDeclaredInvestment = UI field name for 80C (backward-compatible alias)
                            const section80C = Math.min(sc.tdsDeclaredInvestment || sc.section80C || 0, 150000);
                            const section80D = Math.min(sc.section80D || 0, 25000);
                            const taxableIncome = Math.max(0, annualGross - stdDeduction - section80C - section80D);
                            if (taxableIncome <= 250000) annualTax = 0;
                            else if (taxableIncome <= 500000) annualTax = (taxableIncome - 250000) * 0.05;
                            else if (taxableIncome <= 1000000) annualTax = 12500 + (taxableIncome - 500000) * 0.20;
                            else annualTax = 112500 + (taxableIncome - 1000000) * 0.30;
                            if (taxableIncome <= 500000) annualTax = 0;
                        }
                        annualTax = annualTax * 1.04;
                        tdsD = new Decimal(Math.round(annualTax / 12));
                    }
                }

                const otherDeduction = ptD.plus(esicD).round();
                const availableSalaryForDeductions = Decimal.max(0, grossSalary.minus(pfD).minus(tdsD).minus(otherDeduction));

                let loanDeduction = new Decimal(0);
                const empLoanDeductions = [];
                empLoans.forEach(l => {
                    if (l.balance > 0) {
                        const thisEmi = Decimal.min(l.emiAmount || 0, l.balance || 0);
                        loanDeduction = loanDeduction.plus(thisEmi);
                        empLoanDeductions.push({ loanId: l.id, emi: thisEmi, currentBalance: new Decimal(l.balance) });
                    }
                });

                if (config.enableEMICap) {
                    const cap = grossSalary.times(config.emiCapPercentage).dividedBy(100);
                    if (loanDeduction.greaterThan(cap)) {
                        const scale = cap.dividedBy(loanDeduction);
                        empLoanDeductions.forEach(ld => { ld.emi = ld.emi.times(scale).round(); });
                        loanDeduction = cap.round();
                    }
                }
                if (loanDeduction.greaterThan(availableSalaryForDeductions)) loanDeduction = availableSalaryForDeductions;

                const remainingSalaryForAdvance = Decimal.max(0, availableSalaryForDeductions.minus(loanDeduction));
                let advanceDeduction = empAdvances.reduce((sum, a) => sum.plus(Decimal.min(a.monthlyDeduction || 0, a.remainingBalance || 0)), new Decimal(0));

                if (config.enableEMICap) {
                    const cap = grossSalary.times(config.emiCapPercentage).dividedBy(100);
                    if (loanDeduction.plus(advanceDeduction).greaterThan(cap)) {
                        advanceDeduction = Decimal.max(0, cap.minus(loanDeduction)).round();
                    }
                }
                if (advanceDeduction.greaterThan(remainingSalaryForAdvance)) advanceDeduction = remainingSalaryForAdvance;

                const loanD = loanDeduction.round();
                const advD = advanceDeduction.round();
                const totalDeductions = loanD.plus(advD).plus(pfD).plus(tdsD).plus(otherDeduction).round();
                const netSalary = grossSalary.minus(totalDeductions).round();

                for (const ld of empLoanDeductions) {
                    if (ld.emi.greaterThan(0)) {
                        const newBalance = Decimal.max(0, ld.currentBalance.minus(ld.emi)).toDecimalPlaces(2).toNumber();
                        loanBalanceUpdates.push({ loanId: ld.loanId, newBalance });
                    }
                }

                generatedSlips.push({
                    id: Math.random().toString(36).substr(2, 9),
                    companyId, employeeId: emp.id, month,
                    totalDays: daysInMonth, presentDays: presentDaysForStats,
                    paidLeaveDays: 0, absentDays: daysInMonth - presentDaysForStats,
                    basicSalary: basicEarnings.toNumber(), productionAmount: productionEarnings.toNumber(),
                    overtimeAmount: overtimeEarnings.toNumber(), allowances: totalAllowances.toNumber(),
                    grossSalary: grossSalary.toNumber(), loanDeduction: loanD.toNumber(),
                    advanceDeduction: advD.toNumber(), pfDeduction: pfD.toNumber(),
                    taxDeduction: tdsD.toNumber(), otherDeduction: otherDeduction.toNumber(),
                    totalDeductions: totalDeductions.toNumber(), netSalary: netSalary.toNumber(),
                    status: 'DRAFT',
                    generatedOn: new Date().toISOString(),
                    generatedBy: generatedBy || 'Payroll Worker',
                });
            } catch (empErr) {
                perEmployeeErrors.push({ employeeId: emp.id, name: emp.name, error: empErr.message });
            }
        }

        await ReportJob.update({ progress: 70 }, { where: { id: jobId } });

        await SalarySlip.destroy({ where: { companyId, month, status: 'DRAFT' }, transaction: t });
        await SalarySlip.bulkCreate(generatedSlips, { transaction: t });

        for (const upd of loanBalanceUpdates) {
            const newStatus = upd.newBalance <= 0 ? 'CLOSED' : 'ACTIVE';
            await Loan.update({ balance: upd.newBalance, status: newStatus }, { where: { id: upd.loanId }, transaction: t });
        }

        await t.commit();

        await ReportJob.update({
            status: 'COMPLETED', progress: 100,
            downloadUrl: null,
            error: perEmployeeErrors.length > 0 ? JSON.stringify(perEmployeeErrors) : null,
        }, { where: { id: jobId } });

        console.log(`✅ Payroll run completed: ${generatedSlips.length} slips for ${month} (company: ${companyId})`);

    } catch (err) {
        await t.rollback().catch(() => {});
        await ReportJob.update({ status: 'FAILED', error: err.message }, { where: { id: jobId } }).catch(() => {});
        console.error('Payroll worker error:', err);
        process.exit(1);
    }
}

runPayroll().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
