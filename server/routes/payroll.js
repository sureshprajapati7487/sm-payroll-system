// ── PAYROLL + LOANS + LEAVES + PRODUCTION ROUTES ──────────────────────────────
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { requireRole } = require('../rbac');

const { Worker } = require('worker_threads');
const path = require('path');
let Leave, Loan, LoanLedger, SalarySlip, Employee, Attendance, Production, AdvanceSalary, Holiday, SystemSetting, StatutoryRule, ReportJob, addError, getErrorHint;

function init(models) {
    Leave = models.Leave;
    Loan = models.Loan;
    LoanLedger = models.LoanLedger;
    SalarySlip = models.SalarySlip;
    Employee = models.Employee;
    Attendance = models.Attendance;
    Production = models.Production;
    AdvanceSalary = models.AdvanceSalary;
    Holiday = models.Holiday;
    SystemSetting = models.SystemSetting;
    StatutoryRule = models.StatutoryRule;
    ReportJob = models.ReportJob;
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
        // Inject companyId from JWT (prevents cross-tenant records)
        if (req.companyId) payload.companyId = req.companyId;
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
    const { employeeId, status, type } = req.query;
    try {
        const where = {};
        // Use req.companyId from JWT (enforced by requireCompanyScope)
        if (req.companyId) where.companyId = req.companyId;
        if (employeeId) where.employeeId = employeeId;
        if (status) where.status = status;
        if (type) where.type = type;
        res.json(await Loan.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/loans'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.post('/loans', async (req, res) => {
    try {
        const data = { ...req.body };
        // Inject companyId from JWT (prevents cross-tenant records)
        if (req.companyId) data.companyId = req.companyId;
        res.json(await Loan.create(data));
    }
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

        if (LoanLedger) {
            await LoanLedger.create({
                loanId: loan.id,
                employeeId: loan.employeeId,
                companyId: loan.companyId,
                date: loan.issuedDate,
                type: 'PREPAY',
                amount: loan.amount,
                remarks: 'Loan Approved & Issued',
            });
        }

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

        const today = new Date().toISOString().split('T')[0];
        const newLedgerEntry = {
            id: Math.random().toString(36).substr(2, 9),
            date: today,
            amount: amount,
            type: 'EMI',
            remarks: req.body.remarks || 'Manual Payment'
        };
        loan.ledger = [...(loan.ledger || []), newLedgerEntry];
        loan.changed('ledger', true);

        await loan.save();

        if (LoanLedger) {
            await LoanLedger.create({
                loanId: loan.id,
                employeeId: loan.employeeId,
                companyId: loan.companyId,
                date: today,
                type: 'EMI',
                amount,
                remarks: req.body.remarks || 'Manual Payment',
            });
        }

        res.json(loan);
    } catch (e) { addError(e, 'POST /api/loans/:id/pay'); res.status(500).json({ error: e.message }); }
});

// ── P1-06: Loan Ledger Routes ─────────────────────────────────────────────────
router.get('/loans/:id/ledger', async (req, res) => {
    try {
        if (!LoanLedger) return res.status(503).json({ error: 'LoanLedger not available' });
        const entries = await LoanLedger.findAll({
            where: { loanId: req.params.id },
            order: [['createdAt', 'ASC']],
        });
        res.json(entries);
    } catch (e) { addError(e, 'GET /api/loans/:id/ledger'); res.status(500).json({ error: e.message }); }
});

router.post('/loans/:id/ledger', async (req, res) => {
    try {
        if (!LoanLedger) return res.status(503).json({ error: 'LoanLedger not available' });
        const loan = await Loan.findByPk(req.params.id);
        if (!loan) return res.status(404).json({ error: 'Loan not found' });

        const { type = 'EMI', amount, remarks, date } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ error: 'amount is required and must be > 0' });

        const entryDate = date || new Date().toISOString().split('T')[0];

        if (type === 'EMI') {
            const newBal = Math.max(0, (loan.balance || 0) - amount);
            loan.balance = newBal;
            if (newBal <= 0) loan.status = 'CLOSED';
            loan.ledger = [...(loan.ledger || []), { id: uuidv4(), date: entryDate, amount, type, remarks }];
            loan.changed('ledger', true);
            await loan.save();
        }

        const entry = await LoanLedger.create({
            loanId: loan.id,
            employeeId: loan.employeeId,
            companyId: loan.companyId,
            date: entryDate,
            type,
            amount,
            remarks: remarks || '',
        });
        res.status(201).json(entry);
    } catch (e) { addError(e, 'POST /api/loans/:id/ledger'); res.status(500).json({ error: e.message }); }
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
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
        const offset = (page - 1) * limit;
        const { count, rows } = await SalarySlip.findAndCountAll({
            where,
            order: [['month', 'DESC']],
            limit,
            offset,
        });
        res.json({ data: rows, total: count, page, limit, totalPages: Math.ceil(count / limit) });
    } catch (e) { addError(e, 'GET /api/payroll'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.post('/payroll', async (req, res) => {
    try {
        const body = { ...req.body };
        // Inject companyId from JWT (prevents cross-tenant records)
        if (req.companyId) body.companyId = req.companyId;
        // upsert() returns [instance, created] — extract just the record
        const [instance] = await SalarySlip.upsert(body);
        res.json(instance.toJSON());
    }
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

// ── 🚀 ASYNC PAYROLL RUN — spawns a worker thread to avoid blocking the HTTP request ─────
const Decimal = require('decimal.js');

// GET /payroll/job/:jobId — poll for async payroll run status
router.get('/job/:jobId', async (req, res) => {
    try {
        const job = await ReportJob.findOne({
            where: { id: req.params.jobId, companyId: req.companyId || undefined },
        });
        if (!job) return res.status(404).json({ error: 'Job not found' });
        res.json({
            jobId: job.id, status: job.status, progress: job.progress,
            error: job.error, completedAt: job.updatedAt,
        });
    } catch (e) {
        addError(e, 'GET /api/payroll/job/:jobId');
        res.status(500).json({ error: e.message });
    }
});

router.post('/run', requireRole(['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN']), async (req, res) => {
    const { companyId, month, generatedBy } = req.body;
    if (!companyId || !month) return res.status(400).json({ error: 'companyId and month required' });

    try {
        // Create a ReportJob record so the client can poll for status
        const jobId = `payroll-run-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        await ReportJob.create({
            id: jobId,
            companyId,
            requestedBy: req.user?.id || 'SYSTEM',
            reportType: 'payroll_run',
            format: 'internal',
            status: 'PENDING',
            progress: 0,
            payload: JSON.stringify({ companyId, month, generatedBy }),
        });

        // Spawn the payroll computation worker
        const workerPath = path.join(__dirname, '..', 'workers', 'payrollWorker.js');
        const worker = new Worker(workerPath, {
            workerData: { jobId, companyId, month, generatedBy: generatedBy || req.user?.name || 'System' },
        });

        worker.on('error', async (err) => {
            addError(err, `payrollWorker:${jobId}`);
            await ReportJob.update({ status: 'FAILED', error: err.message }, { where: { id: jobId } }).catch(() => {});
        });

        // Return immediately — client polls GET /api/payroll/job/:jobId
        return res.status(202).json({ jobId, message: 'Payroll run started. Poll /api/payroll/job/:jobId for status.' });

    } catch (outerErr) {
        // THIS IS TEMPORARY DEAD CODE — kept as a safety net in case worker creation fails
        // Fall back to in-process synchronous run (will block until complete)
        const INLINE_FALLBACK = true; // set false to disable fallback if worker always available
        if (!INLINE_FALLBACK) {
            addError(outerErr, 'POST /api/payroll/run:setup');
            const h = getErrorHint(outerErr);
            return res.status(500).json({ error: outerErr.message, why: h.why, fix: h.fix });
        }
    }

    // ── INLINE FALLBACK: synchronous computation (only reached if worker setup fails) ──
    const sequelize = Employee.sequelize;
    const t = await sequelize.transaction();

    try {
        // 1. Fetch raw data
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

        const year = Number(month.split('-')[0]);
        const monthNum = Number(month.split('-')[1]);
        const daysInMonth = new Date(year, monthNum, 0).getDate();
        const monthEndDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

        // Find the applicable statutory rule (first rule where effectiveDate <= month end date)
        const activeStatutoryRule = statutoryRules.find(r => r.effectiveDate <= monthEndDate) || null;

        // Config defaults — overridden by per-company SystemSetting key 'PAYROLL_CONFIG'
        const configDefaults = {
            enableZeroPresenceRule: true,
            enableSandwichRule: true,
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
        const loanBalanceUpdates = []; // Collect loan balance changes — applied in batch inside transaction
        const perEmployeeErrors = []; // Non-fatal per-employee errors collected for the response

        for (const emp of employees) {
          try {
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

            // TDS — FY2024-25 slabs applied per employee's elected tax regime
            if (sc.tdsApplicable) {
                const gVal = grossSalary.toNumber();
                if (sc.tdsPercentage !== undefined) {
                    // Override: fixed percentage configured on employee
                    tdsD = grossSalary.times(sc.tdsPercentage).dividedBy(100).round();
                } else if (!sc.tdsPanLinked) {
                    // No PAN: mandatory 20% TDS
                    tdsD = grossSalary.times(20).dividedBy(100).round();
                } else {
                    const annualGross = gVal * 12;
                    const regime = emp.taxRegime || 'NEW';
                    let annualTax = 0;

                    if (regime === 'NEW') {
                        // New Regime FY2024-25: no deductions, simplified slabs
                        if (annualGross <= 300000) annualTax = 0;
                        else if (annualGross <= 700000) annualTax = (annualGross - 300000) * 0.05;
                        else if (annualGross <= 1000000) annualTax = 20000 + (annualGross - 700000) * 0.10;
                        else if (annualGross <= 1200000) annualTax = 50000 + (annualGross - 1000000) * 0.15;
                        else if (annualGross <= 1500000) annualTax = 80000 + (annualGross - 1200000) * 0.20;
                        else annualTax = 140000 + (annualGross - 1500000) * 0.30;
                        // Rebate u/s 87A — zero tax up to ₹7L under new regime
                        if (annualGross <= 700000) annualTax = 0;
                    } else {
                        // Old Regime FY2024-25: with standard deduction ₹50,000
                        const stdDeduction = 50000;
                        const section80C = Math.min(sc.section80C || 0, 150000); // Capped at ₹1.5L
                        const section80D = Math.min(sc.section80D || 0, 25000);  // Basic medical premium
                        const taxableIncome = Math.max(0, annualGross - stdDeduction - section80C - section80D);

                        if (taxableIncome <= 250000) annualTax = 0;
                        else if (taxableIncome <= 500000) annualTax = (taxableIncome - 250000) * 0.05;
                        else if (taxableIncome <= 1000000) annualTax = 12500 + (taxableIncome - 500000) * 0.20;
                        else annualTax = 112500 + (taxableIncome - 1000000) * 0.30;
                        // Rebate u/s 87A — zero tax up to ₹5L under old regime
                        if (taxableIncome <= 500000) annualTax = 0;
                    }

                    // 4% Health & Education Cess on computed tax
                    annualTax = annualTax * 1.04;
                    tdsD = new Decimal(Math.round(annualTax / 12));
                }
            }
            const tdsDeduction = tdsD.toNumber();
            const pfDeduction = pfD.toNumber();

            const otherDeduction = ptD.plus(esicD).round();

            // ── EMI CARRY FORWARD CAP ────────────────────────────────────────────────
            const availableSalaryForDeductions = Decimal.max(0, grossSalary.minus(pfD).minus(tdsD).minus(otherDeduction));

            let loanDeduction = new Decimal(0);
            const empLoanDeductions = []; // Track per-loan deduction for balance update
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
                    // Scale each loan deduction proportionally to fit within cap
                    const scale = cap.dividedBy(loanDeduction);
                    empLoanDeductions.forEach(ld => { ld.emi = ld.emi.times(scale).round(); });
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

            // Collect loan balance updates — applied atomically after all slips are computed
            for (const ld of empLoanDeductions) {
                if (ld.emi.greaterThan(0)) {
                    const newBalance = Decimal.max(0, ld.currentBalance.minus(ld.emi)).toDecimalPlaces(2).toNumber();
                    loanBalanceUpdates.push({ loanId: ld.loanId, newBalance });
                }
            }

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
          } catch (empErr) {
            // Per-employee error is non-fatal — collect and continue generating other slips
            perEmployeeErrors.push({ employeeId: emp.id, name: emp.name, error: empErr.message });
          }
        }

        // Wipe old DRAFT slips for this month and bulk-insert new ones atomically
        await SalarySlip.destroy({
            where: { companyId, month, status: 'DRAFT' },
            transaction: t
        });

        await SalarySlip.bulkCreate(generatedSlips, { transaction: t });

        // Apply all loan balance updates inside the same transaction
        for (const upd of loanBalanceUpdates) {
            const newStatus = upd.newBalance <= 0 ? 'CLOSED' : 'ACTIVE';
            await Loan.update(
                { balance: upd.newBalance, status: newStatus },
                { where: { id: upd.loanId }, transaction: t }
            );
        }

        await t.commit();

        res.json({
            success: true,
            count: generatedSlips.length,
            ...(perEmployeeErrors.length > 0 && { warnings: perEmployeeErrors }),
        });
    } catch (e) {
        await t.rollback();
        addError(e, 'POST /api/payroll/run');
        const h = getErrorHint(e);
        res.status(500).json({ error: e.message, why: h.why, fix: h.fix });
    }
});

// ── PAYROLL STATE MACHINE ───────────────────────────────────────────────────────
router.patch('/:id/simulate', requireRole(['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN']), async (req, res) => {
    try {
        const slip = await SalarySlip.findByPk(req.params.id);
        if (!slip) return res.status(404).json({ error: 'Not found' });
        if (slip.status !== 'DRAFT') return res.status(400).json({ error: 'Only DRAFT can be SIMULATED' });

        slip.status = 'SIMULATION';
        await slip.save();
        res.json(slip);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/approve', requireRole(['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN']), async (req, res) => {
    try {
        const slip = await SalarySlip.findByPk(req.params.id);
        if (!slip) return res.status(404).json({ error: 'Not found' });
        if (slip.status !== 'SIMULATION') return res.status(400).json({ error: 'Only SIMULATED slips can be APPROVED' });

        slip.status = 'FINAL_APPROVED';
        await slip.save();
        res.json(slip);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/lock', requireRole(['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN']), async (req, res) => {
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

// ── P1-01: Statutory Export Routes ───────────────────────────────────────────

function csvEsc(v) {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
}

// 1. PF ECR CSV
router.get('/payroll/export/pf-ecr', requireRole(['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN']), async (req, res) => {
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: 'month query param required (e.g. 2024-05)' });
    try {
        const where = { month };
        if (req.companyId) where.companyId = req.companyId;
        const slips = await SalarySlip.findAll({ where });
        if (!slips.length) return res.status(404).json({ error: 'No payroll data for this period' });

        const empIds = [...new Set(slips.map(s => s.employeeId))];
        const employees = await Employee.findAll({ where: { id: empIds } });
        const empMap = Object.fromEntries(employees.map(e => [e.id, e]));

        const header = ['UAN', 'EmployeeName', 'GrossWages', 'EPFWages', 'EPS', 'EPFContrib', 'EPSContrib'];
        const rows = slips.map(s => {
            const emp = empMap[s.employeeId] || {};
            const bd = emp.bankDetails || {};
            const epfWages = Math.min(s.grossSalary || 0, 15000);
            return [
                csvEsc(bd.uan || ''),
                csvEsc(emp.name || ''),
                csvEsc((s.grossSalary || 0).toFixed(2)),
                csvEsc(epfWages.toFixed(2)),
                csvEsc(epfWages.toFixed(2)),
                csvEsc((epfWages * 0.12).toFixed(2)),
                csvEsc((epfWages * 0.0833).toFixed(2)),
            ].join(',');
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="pf-ecr-${month}.csv"`);
        res.send([header.join(','), ...rows].join('\n'));
    } catch (e) { addError(e, 'GET /api/payroll/export/pf-ecr'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// 2. ESIC CSV
router.get('/payroll/export/esic', requireRole(['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN']), async (req, res) => {
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: 'month query param required (e.g. 2024-05)' });
    try {
        const where = { month };
        if (req.companyId) where.companyId = req.companyId;
        const slips = await SalarySlip.findAll({ where });
        if (!slips.length) return res.status(404).json({ error: 'No payroll data for this period' });

        const empIds = [...new Set(slips.map(s => s.employeeId))];
        const employees = await Employee.findAll({ where: { id: empIds } });
        const empMap = Object.fromEntries(employees.map(e => [e.id, e]));

        const header = ['ESICNumber', 'EmployeeName', 'GrossWages', 'EmployeeESIC', 'EmployerESIC'];
        const rows = slips.map(s => {
            const emp = empMap[s.employeeId] || {};
            const bd = emp.bankDetails || {};
            const gross = s.grossSalary || 0;
            return [
                csvEsc(bd.esicNumber || ''),
                csvEsc(emp.name || ''),
                csvEsc(gross.toFixed(2)),
                csvEsc((gross * 0.0075).toFixed(2)),
                csvEsc((gross * 0.0325).toFixed(2)),
            ].join(',');
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="esic-${month}.csv"`);
        res.send([header.join(','), ...rows].join('\n'));
    } catch (e) { addError(e, 'GET /api/payroll/export/esic'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// 3. Form-16 HTML
router.get('/payroll/export/form16/:employeeId', requireRole(['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN']), async (req, res) => {
    const { year } = req.query; // e.g. "2024-25"
    if (!year || !/^\d{4}-\d{2}$/.test(year)) return res.status(400).json({ error: 'year query param required (e.g. 2024-25)' });
    try {
        const startY = parseInt(year.split('-')[0], 10);
        const months = [];
        for (let m = 4; m <= 12; m++) months.push(`${startY}-${String(m).padStart(2, '0')}`);
        for (let m = 1; m <= 3; m++) months.push(`${startY + 1}-${String(m).padStart(2, '0')}`);

        const where = { employeeId: req.params.employeeId, month: months };
        if (req.companyId) where.companyId = req.companyId;
        const slips = await SalarySlip.findAll({ where });
        if (!slips.length) return res.status(404).json({ error: 'No payroll data for this period' });

        const emp = await Employee.findOne({ where: { id: req.params.employeeId } });
        const bd = emp?.bankDetails || {};
        const totGross = slips.reduce((s, r) => s + (r.grossSalary || 0), 0);
        const totTDS   = slips.reduce((s, r) => s + (r.taxDeduction || 0), 0);

        const breakdown = slips
            .sort((a, b) => a.month.localeCompare(b.month))
            .map(s => `<tr><td>${s.month}</td><td>₹${(s.grossSalary||0).toFixed(2)}</td><td>₹${(s.taxDeduction||0).toFixed(2)}</td></tr>`)
            .join('');

        res.setHeader('Content-Type', 'text/html');
        res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Form-16 — ${year}</title>
<style>body{font-family:Arial,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f0f0f0}</style>
</head><body>
<h2>Form-16 — Financial Year ${year}</h2>
<p><strong>Employee Name:</strong> ${emp?.name || req.params.employeeId}</p>
<p><strong>PAN:</strong> ${bd.pan || 'N/A'}</p>
<h3>Summary</h3>
<table>
  <tr><td><b>Total Gross Salary</b></td><td>₹${totGross.toFixed(2)}</td></tr>
  <tr><td><b>Total TDS Deducted</b></td><td>₹${totTDS.toFixed(2)}</td></tr>
</table>
<h3>Annual Breakdown</h3>
<table><tr><th>Month</th><th>Gross Salary</th><th>TDS</th></tr>${breakdown}</table>
</body></html>`);
    } catch (e) { addError(e, 'GET /api/payroll/export/form16/:employeeId'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

module.exports = { router, init };
