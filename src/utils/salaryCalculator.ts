import {
    Employee,
    AttendanceRecord,
    ProductionEntry,
    LoanRecord,
    SalarySlip,
    SalaryType,
    AttendanceStatus,
    Holiday
} from '@/types';

import { useSystemConfigStore } from '@/store/systemConfigStore';

export const calculateSalary = (
    employee: Employee,
    month: string, // YYYY-MM
    attendanceRecords: AttendanceRecord[],
    productionEntries: ProductionEntry[],
    activeLoans: LoanRecord[],
    holidays: Holiday[] = [],
    advanceMonthlyDeduction: number = 0  // ← Total advance EMI to recover this month
): SalarySlip => {
    // 1. Filter Data for Month
    const monthRecords = attendanceRecords.filter(r => r.date.startsWith(month));
    const monthProds = productionEntries.filter(p => p.date.startsWith(month) && p.status === 'APPROVED');

    // 2. Calculate Days
    const year = Number(month.split('-')[0]);
    const monthNum = Number(month.split('-')[1]);
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    // Stats Buckets (Clean Logic)
    let normalWorkedDays = 0;       // Mon-Sat Work
    let normalHalfDays = 0;         // Mon-Sat Half-Day

    let holidayBaseDays = 0;        // Paid Holiday Benefit (Standard Pay)
    let offDayWorkedDays = 0;       // Off-Day Work (OT Bonus)
    let offDayHalfDays = 0;         // Off-Day Half Work (OT Bonus)

    let presentDaysForStats = 0;    // Visual only (Total Present)

    let overtimeHours = 0;
    let totalWorkedDaysForRule = 0; // For Zero Presence & Attendance Bonus

    // Penalties & Add-ons
    let lateMarksCount = 0;
    let earlyGoCount = 0;
    let nightShiftDays = 0;
    let isPerfectAttendance = true;

    // Config Rules
    const config = useSystemConfigStore.getState();
    const enableZeroPresenceRule = config.enableZeroPresenceRule ?? true;
    const enableSandwichRule = config.enableSandwichRule ?? true;
    console.log('[SalaryCalc] Config (Loaded):', config);

    // Helper to check if a date is an Off Day
    const checkIsOffDay = (dateStr: string) => {
        const dObj = new Date(dateStr + 'T12:00:00Z');
        const isSun = dObj.getUTCDay() === 0;
        const isHol = holidays.some(h => h.date === dateStr);
        return isSun || isHol;
    };

    // Helper to check present
    const checkIsPresent = (dateStr: string) => {
        const r = monthRecords.find(x => x.date === dateStr);
        return !!(r && (r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE || r.status === AttendanceStatus.HALF_DAY));
    };

    // --- MAIN CALCULATION LOOP ---
    for (let i = 1; i <= daysInMonth; i++) {
        const date = `${month}-${String(i).padStart(2, '0')}`;
        const record = monthRecords.find(r => r.date === date);
        const isOffDay = checkIsOffDay(date);

        // A. WORK TRACKING
        if (record) {
            // Stats Update
            if (record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.LATE || record.status === AttendanceStatus.HALF_DAY) {
                if (record.status === AttendanceStatus.HALF_DAY) presentDaysForStats += 0.5;
                else presentDaysForStats++;
            }

            // Bucket Sorting
            if (record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.LATE) {
                if (!isOffDay) {
                    normalWorkedDays++;
                } else {
                    offDayWorkedDays++; // Bonus
                }
                totalWorkedDaysForRule++;

                if (record.status === AttendanceStatus.LATE) lateMarksCount++;
            }
            else if (record.status === AttendanceStatus.HALF_DAY) {
                if (!isOffDay) {
                    normalHalfDays++;
                } else {
                    offDayHalfDays++; // Bonus
                }
                totalWorkedDaysForRule += 0.5;
                isPerfectAttendance = false;
            }
            else if (record.status === AttendanceStatus.ABSENT) {
                isPerfectAttendance = false;
            }

            // Early Go
            // if (record.isEarlyGo) earlyGoCount++;

            // Night Shift
            if (record.checkIn && config.enableNightShiftAllowance) {
                const checkInHour = new Date(record.checkIn).getHours();
                if (checkInHour >= config.nightShiftStartHour || checkInHour < config.nightShiftEndHour) {
                    nightShiftDays++;
                }
            }

            overtimeHours += record.overtimeHours || 0;
        } else if (!isOffDay) {
            isPerfectAttendance = false; // Implicit Absent
        }

        // B. HOLIDAY BENEFIT (Standard Pay)
        if (employee.salaryType === SalaryType.MONTHLY && isOffDay) {
            let isPaid = true;
            if (enableSandwichRule) {
                let prevDateStr = '';
                for (let d = i - 1; d >= 1; d--) {
                    const tempDate = `${month}-${String(d).padStart(2, '0')}`;
                    if (!checkIsOffDay(tempDate)) { prevDateStr = tempDate; break; }
                }
                let nextDateStr = '';
                for (let d = i + 1; d <= daysInMonth; d++) {
                    const tempDate = `${month}-${String(d).padStart(2, '0')}`;
                    if (!checkIsOffDay(tempDate)) { nextDateStr = tempDate; break; }
                }
                const prevOk = prevDateStr ? checkIsPresent(prevDateStr) : true;
                const nextOk = nextDateStr ? checkIsPresent(nextDateStr) : true;

                // Logic 1: Both Present -> Paid
                if (prevOk && nextOk) {
                    isPaid = true;
                }
                // Logic 3: Both Absent -> Unpaid
                else if (!prevOk && !nextOk) {
                    isPaid = false;
                }
                // Logic 2: Single Side Present -> Relaxed Check
                else {
                    let anyAttendanceInWeek = false;
                    let daysChecked = 0;
                    let scanDate = i - 1;

                    while (daysChecked < 6 && scanDate >= 1) {
                        const dStr = `${month}-${String(scanDate).padStart(2, '0')}`;
                        if (!checkIsOffDay(dStr)) {
                            // Working Day: Check if Present
                            if (checkIsPresent(dStr)) {
                                anyAttendanceInWeek = true;
                                break;
                            }
                            daysChecked++;
                        }
                        scanDate--;
                    }
                    isPaid = anyAttendanceInWeek;
                }
            }

            if (isPaid) {
                holidayBaseDays += 1.0;
            }
        }
    }

    // Zero Presence Rule
    if (enableZeroPresenceRule && totalWorkedDaysForRule === 0) {
        holidayBaseDays = 0;
        presentDaysForStats = 0;
    }

    // --- FINAL DAYS CALCULATION ---
    // 1. Base Salary Days
    let basePaidDays = normalWorkedDays + (normalHalfDays * 0.5) + holidayBaseDays;

    // 2. OT Bonus Days
    const otBonusDays = offDayWorkedDays + (offDayHalfDays * 0.5);


    // --- PENALTIES DEDUCTION (From Base Days) ---
    // Late Marks
    let lateMarksPenaltyAmount = 0;
    if (config.enableLateMarksPenalty && lateMarksCount >= config.lateMarksThreshold) {
        const penaltyCycles = Math.floor(lateMarksCount / config.lateMarksThreshold);
        if (config.lateMarksPenaltyType === 'HALF_DAY') {
            basePaidDays -= (0.5 * penaltyCycles);
        } else if (config.lateMarksPenaltyType === 'FULL_DAY') {
            basePaidDays -= (1.0 * penaltyCycles);
        } else if (config.lateMarksPenaltyType === 'CUSTOM_AMOUNT') {
            lateMarksPenaltyAmount = config.lateMarksPenaltyAmount * penaltyCycles;
        }
    }

    // Early Go
    if (config.enableEarlyGoPenalty && earlyGoCount > 0) {
        if (config.earlyGoPenaltyType === 'HALF_DAY') {
            basePaidDays -= (0.5 * earlyGoCount);
        } else if (config.earlyGoPenaltyType === 'FULL_DAY') {
            basePaidDays -= (1.0 * earlyGoCount);
        }
    }

    basePaidDays = Math.max(0, basePaidDays); // Prevent negative


    // --- EARNINGS ---
    let basicEarnings = 0;
    let productionEarnings = 0;
    let overtimeEarnings = 0;

    // A. Fixed Salary
    if (employee.salaryType === SalaryType.MONTHLY) {
        // Base Salary covers All Paid Days (Base + OT Bonus)
        const perDayRate = employee.basicSalary / daysInMonth;
        basicEarnings = Math.round(perDayRate * (basePaidDays + otBonusDays));

        // OT Earnings is ONLY Hourly OT
        let effectiveOTHours = overtimeHours;
        if (config.enableOTMinThreshold && effectiveOTHours < (config.otMinThresholdMinutes / 60)) {
            effectiveOTHours = 0;
        }
        if (config.enableOTCap && effectiveOTHours > config.otCapHoursPerMonth) {
            effectiveOTHours = config.otCapHoursPerMonth;
        }

        const hourlyRate = (employee.basicSalary / 30) / 9;
        const otMultiplier = config.enableOTMultipliers ? config.otNormalMultiplier : 1.5;
        const hourlyPay = Math.round(hourlyRate * effectiveOTHours * otMultiplier);

        overtimeEarnings = hourlyPay;
    }
    // B. Daily/Hourly
    else if (employee.salaryType === SalaryType.DAILY) {
        const rate = employee.paymentRate || 0;
        const totalPaid = basePaidDays + otBonusDays;
        basicEarnings = Math.round(rate * totalPaid);

        const hourlyRate = rate / 9;
        overtimeEarnings = Math.round(hourlyRate * overtimeHours);
    }
    else if (employee.salaryType === SalaryType.HOURLY) {
        const rate = employee.paymentRate || 0;
        const totalPaid = basePaidDays + otBonusDays;
        basicEarnings = Math.round(rate * totalPaid * 9);
        overtimeEarnings = Math.round(rate * overtimeHours);
    }

    // C. Production
    productionEarnings = monthProds.reduce((sum, p) => sum + p.totalAmount, 0);

    // D. Allowances
    let nightShiftAllowance = 0;
    if (config.enableNightShiftAllowance) {
        nightShiftAllowance = nightShiftDays * config.nightShiftAllowanceAmount;
    }
    let attendanceBonus = 0;
    if (config.enableAttendanceBonus && isPerfectAttendance && totalWorkedDaysForRule > 0) {
        attendanceBonus = config.attendanceBonusAmount;
    }
    const totalAllowances = nightShiftAllowance + attendanceBonus;


    // --- DEDUCTIONS ---
    let loanDeduction = 0;
    activeLoans.forEach(loan => {
        if (loan.balance > 0) {
            const deduction = Math.min(loan.emiAmount, loan.balance);
            loanDeduction += deduction;
        }
    });

    // EMI Cap
    const grossBeforeDeductions = basicEarnings + productionEarnings + overtimeEarnings + totalAllowances;
    if (config.enableEMICap) {
        const maxAllowedEMI = (grossBeforeDeductions * config.emiCapPercentage) / 100;
        if (loanDeduction > maxAllowedEMI) {
            loanDeduction = Math.round(maxAllowedEMI);
        }
    }

    const grossSalary = basicEarnings + productionEarnings + overtimeEarnings + totalAllowances;

    // ── STATUTORY DEDUCTIONS ─────────────────────────────────────────────────
    const sc = employee.statutoryConfig;

    // A. PF — Provident Fund (Employee share: 12% of basic, max ₹1,800 if capped)
    let pfDeduction = 0;
    if (sc?.pfApplicable) {
        const pfRate = (sc.pfRate ?? 12) / 100;
        const pfBase = employee.basicSalary;  // Always on CTC basic, not earned basic
        const rawPF = Math.round(pfBase * pfRate);
        if (sc.pfCapped ?? true) {
            // Statutory cap: 12% of ₹15,000 = ₹1,800
            pfDeduction = Math.min(rawPF, 1800);
        } else {
            pfDeduction = rawPF;
        }
    }

    // B. ESIC — Employee State Insurance (0.75% of gross; only if gross ≤ ₹21,000)
    let esicDeduction = 0;
    if (sc?.esicApplicable && grossSalary <= 21000) {
        const esicRate = (sc.esicRate ?? 0.75) / 100;
        esicDeduction = Math.round(grossSalary * esicRate);
    }

    // C. PT — Professional Tax (monthly slab, default ₹200)
    let ptDeduction = 0;
    if (sc?.ptApplicable) {
        if (sc.ptAmount !== undefined) {
            ptDeduction = sc.ptAmount;
        } else {
            // Standard India PT slabs (most states: ₹200/month if salary > ₹15,000)
            if (grossSalary > 15000) ptDeduction = 200;
            else if (grossSalary > 10000) ptDeduction = 150;
            else if (grossSalary > 7500) ptDeduction = 100;
            else ptDeduction = 0;
        }
    }

    // D. TDS — Tax Deducted at Source (monthly installment of annual tax liability)
    let tdsDeduction = 0;
    if (sc?.tdsApplicable) {
        if (sc.tdsPercentage !== undefined) {
            // Manual override
            tdsDeduction = Math.round((grossSalary * sc.tdsPercentage) / 100);
        } else {
            // Estimate annual income
            const annualGross = grossSalary * 12;
            const invested80C = sc.tdsDeclaredInvestment ?? 0;
            const standardDeduction = 50000;
            const taxableIncome = Math.max(0, annualGross - standardDeduction - Math.min(invested80C, 150000));

            // New Tax Regime slabs (FY 2024-25)
            let annualTax = 0;
            if (taxableIncome <= 300000) annualTax = 0;
            else if (taxableIncome <= 600000) annualTax = (taxableIncome - 300000) * 0.05;
            else if (taxableIncome <= 900000) annualTax = 15000 + (taxableIncome - 600000) * 0.10;
            else if (taxableIncome <= 1200000) annualTax = 45000 + (taxableIncome - 900000) * 0.15;
            else if (taxableIncome <= 1500000) annualTax = 90000 + (taxableIncome - 1200000) * 0.20;
            else annualTax = 150000 + (taxableIncome - 1500000) * 0.30;

            // Add 4% health & education cess
            annualTax = annualTax * 1.04;

            // If PAN not linked, flat 20%
            if (!sc.tdsPanLinked) {
                tdsDeduction = Math.round((grossSalary * 20) / 100);
            } else {
                tdsDeduction = Math.round(annualTax / 12);
            }
        }
    }

    const otherDeduction = lateMarksPenaltyAmount + ptDeduction + esicDeduction;

    // Advance salary deduction (cap at gross like EMI cap)
    let advanceDeduction = advanceMonthlyDeduction;
    if (config.enableEMICap && advanceDeduction > 0) {
        const maxAllowedTotal = (grossSalary * config.emiCapPercentage) / 100;
        const alreadyUsed = loanDeduction;
        const remaining = Math.max(0, maxAllowedTotal - alreadyUsed);
        advanceDeduction = Math.min(advanceDeduction, remaining);
    }
    advanceDeduction = Math.min(advanceDeduction, Math.max(0, grossSalary - loanDeduction - pfDeduction - tdsDeduction - otherDeduction));
    advanceDeduction = Math.round(advanceDeduction);

    const totalDeductions = loanDeduction + advanceDeduction + pfDeduction + tdsDeduction + otherDeduction;
    const netSalary = Math.round(grossSalary - totalDeductions);

    return {
        id: Math.random().toString(36).substr(2, 9),
        employeeId: employee.id,
        month,
        totalDays: daysInMonth,
        presentDays: presentDaysForStats,
        paidLeaveDays: 0,
        absentDays: daysInMonth - presentDaysForStats,

        basicSalary: basicEarnings,
        productionAmount: productionEarnings,
        overtimeAmount: overtimeEarnings,
        allowances: totalAllowances,
        grossSalary,

        loanDeduction,
        advanceDeduction,
        pfDeduction,
        taxDeduction: tdsDeduction,
        otherDeduction,
        totalDeductions,

        netSalary,
        status: 'GENERATED',
        generatedBy: 'System',
        generatedOn: new Date().toISOString(),
    };
};
