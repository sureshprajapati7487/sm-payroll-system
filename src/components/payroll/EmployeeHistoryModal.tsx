import { createPortal } from 'react-dom';
import { X, Printer, FileSpreadsheet, Settings } from 'lucide-react';
import { useState } from 'react';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useProductionStore } from '@/store/productionStore';
import { useLoanStore } from '@/store/loanStore';
import { useHolidayStore } from '@/store/holidayStore';
import { useSystemConfigStore } from '@/store/systemConfigStore';
import { Employee, SalaryType, AttendanceStatus, LoanType } from '@/types';
import { clsx } from 'clsx';
import { exportEmployeePayoutToExcel } from '@/utils/exportUtils';
import { useAuthStore } from '@/store/authStore';

interface EmployeeHistoryModalProps {
    employee: Employee;
    month: string; // YYYY-MM
    onClose: () => void;
}

export const EmployeeHistoryModal = ({ employee, month, onClose }: EmployeeHistoryModalProps) => {
    const { records } = useAttendanceStore();
    const { entries } = useProductionStore();
    const { loans } = useLoanStore();
    const user = useAuthStore(s => s.user);

    const [year, monthNum] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    // --- Calculations ---
    const activeLoans = loans.filter(l => l.employeeId === employee.id && (l.status === 'ACTIVE' || l.status === 'CLOSED'));

    // Config Rules
    const { enableZeroPresenceRule, enableSandwichRule } = useSystemConfigStore.getState();

    // 1. Attendance Stats - CLEAN BUCKETS
    let normalWorkedDays = 0;       // Work on Mon-Sat
    let normalHalfDays = 0;         // Half-Day on Mon-Sat

    let holidayBaseDays = 0;        // Standard Paid Off-Days (Base Benefit)
    let offDayWorkedDays = 0;       // Work on Sun/Holiday (OT Bonus 1.0)
    let offDayHalfDays = 0;         // Half-Day on Sun/Holiday (OT Bonus 0.5)

    let totalAbsent = 0;
    let totalOTHours = 0;           // Hourly OT
    let totalWorkedDaysCheck = 0;   // For Zero Presence Rule

    const { isHoliday } = useHolidayStore.getState();

    // Helper to check if a date is an Off Day (Sunday or Holiday)
    const checkIsOffDay = (dateStr: string) => {
        const dObj = new Date(dateStr + 'T12:00:00Z'); // Noon UTC
        const isSun = dObj.getUTCDay() === 0;
        const holiday = isHoliday(dateStr);
        return isSun || holiday;
    };

    // Helper to check present
    const checkIsPresent = (dateStr: string) => {
        const r = records.find(x => x.employeeId === employee.id && x.date === dateStr);
        return !!(r && (r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE || r.status === AttendanceStatus.HALF_DAY));
    };

    // --- MAIN CALCULATION LOOP ---
    for (let i = 1; i <= daysInMonth; i++) {
        const date = `${month}-${String(i).padStart(2, '0')}`;
        const record = records.find(r => r.employeeId === employee.id && r.date === date);
        const isOffDay = checkIsOffDay(date);

        // A. WORK TRACKING
        if (record) {
            if (record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.LATE) {
                if (!isOffDay) {
                    normalWorkedDays++;
                } else {
                    offDayWorkedDays++; // Bonus
                }
                totalWorkedDaysCheck++;
            }
            else if (record.status === AttendanceStatus.HALF_DAY) {
                if (!isOffDay) {
                    normalHalfDays++;
                } else {
                    offDayHalfDays++; // Bonus
                }
                totalWorkedDaysCheck += 0.5;
            }

            // Absent Logic (Only counts on Normal Days)
            if (!isOffDay && record.status === AttendanceStatus.ABSENT) {
                totalAbsent++;
            }

            if (record.overtimeHours) totalOTHours += record.overtimeHours;
        }

        // B. HOLIDAY BENEFIT (Standard Pay for Off-Days)
        // Only for Monthly Salary employees
        if (employee.salaryType === SalaryType.MONTHLY && isOffDay) {
            let isPaid = true;

            // Sandwich Rule
            if (enableSandwichRule) {
                // Find Prev Working Day
                let prevDateStr = '';
                for (let d = i - 1; d >= 1; d--) {
                    const tempDate = `${month}-${String(d).padStart(2, '0')}`;
                    if (!checkIsOffDay(tempDate)) {
                        prevDateStr = tempDate;
                        break;
                    }
                }
                // Find Next Working Day
                let nextDateStr = '';
                for (let d = i + 1; d <= daysInMonth; d++) {
                    const tempDate = `${month}-${String(d).padStart(2, '0')}`;
                    if (!checkIsOffDay(tempDate)) {
                        nextDateStr = tempDate;
                        break;
                    }
                }
                const prevOk = prevDateStr ? checkIsPresent(prevDateStr) : true;
                const nextOk = nextDateStr ? checkIsPresent(nextDateStr) : true;

                // Logic 1: Both Present (-1 AND +1) -> PAID
                if (prevOk && nextOk) {
                    isPaid = true;
                }
                // Logic 3: Both Absent (-1 AND +1) -> UNPAID
                else if (!prevOk && !nextOk) {
                    isPaid = false;
                }
                // Logic 2: Single Side Present (-1 OR +1) -> Relaxed Check
                else {
                    let anyAttendanceInWeek = false;
                    let daysChecked = 0;
                    let scanDate = i - 1; // Start from day before holiday

                    while (daysChecked < 6 && scanDate >= 1) {
                        const dStr = `${month}-${String(scanDate).padStart(2, '0')}`;
                        if (!checkIsOffDay(dStr)) {
                            // Working Day: Check if Present
                            if (checkIsPresent(dStr)) {
                                anyAttendanceInWeek = true;
                                break; // Found one!
                            }
                            daysChecked++;
                        }
                        scanDate--;
                    }

                    if (anyAttendanceInWeek) {
                        isPaid = true;
                    } else {
                        isPaid = false;
                    }
                }
            }

            if (isPaid) {
                holidayBaseDays += 1.0;
            }
        }
    }

    // Zero Presence Rule
    if (enableZeroPresenceRule && totalWorkedDaysCheck === 0) {
        holidayBaseDays = 0; // Forfeit paid holidays
    }

    // --- FINAL FORMULAS ---
    // 1. Base Salary Days (Includes Normal Work + Holiday Benefits)
    const basePaidDays = normalWorkedDays + (normalHalfDays * 0.5) + holidayBaseDays;

    // 2. OT Bonus Days (Includes Off-Day Work)
    const otBonusDays = offDayWorkedDays + (offDayHalfDays * 0.5);

    // 3. Total Paid Days (For UI Display)
    const totalPaidDaysDisplay = basePaidDays + otBonusDays;


    // 2. Production / Earnings
    const prodEntries = entries.filter(p => p.employeeId === employee.id && p.date.startsWith(month) && p.status === 'APPROVED');
    const totalProductionAmount = prodEntries.reduce((sum, p) => sum + p.totalAmount, 0);

    // 3. Salary
    let basicSalary = 0;
    let otEarnings = 0;

    if (employee.salaryType === SalaryType.MONTHLY) {
        const perDayRate = employee.basicSalary / daysInMonth;

        // Base Salary covers ALL Paid Days (Base + OT Bonus)
        basicSalary = Math.round(perDayRate * totalPaidDaysDisplay);

        // OT Earnings is ONLY for Hours now
        const hourlyRate = (employee.basicSalary / 30) / 9; // Approx rate
        const hourlyPay = Math.round(hourlyRate * totalOTHours * 1.5); // 1.5x for hours
        otEarnings = hourlyPay;

    } else if (employee.salaryType === SalaryType.DAILY) {
        basicSalary = (employee.paymentRate || 0) * totalPaidDaysDisplay;

        const hourlyRate = (employee.paymentRate || 0) / 9;
        otEarnings = Math.round(hourlyRate * totalOTHours);
    }

    const grossSalary = basicSalary + totalProductionAmount + otEarnings;

    // 5. Loan Deductions
    let totalLoanDeduction = 0;
    const currentMonthLoans = activeLoans.filter(l => l.balance > 0);
    currentMonthLoans.forEach(l => {
        totalLoanDeduction += Math.min(l.emiAmount, l.balance);
    });

    const netSalary = grossSalary - totalLoanDeduction;

    // Split Loans for UI
    const bigLoans = activeLoans.filter(l => [LoanType.PF_LOAN, LoanType.SALARY_PAY, LoanType.OTHER].includes(l.type));
    const smallLoans = activeLoans.filter(l => [LoanType.FOOD, LoanType.ADVANCE_CASH, LoanType.FINE].includes(l.type));

    const totalBigLoans = bigLoans.reduce((sum, l) => sum + l.amount, 0);
    const totalSmallLoans = smallLoans.reduce((sum, l) => sum + l.amount, 0);
    const combinedTotalLoan = totalBigLoans + totalSmallLoans;


    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '--';
        return new Date(dateStr).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });
    };

    // --- EXPORT HANDLERS ---
    const handleExportExcel = () => {
        const attendanceData = Array.from({ length: daysInMonth }, (_, i) => {
            const dateStr = `${month}-${String(i + 1).padStart(2, '0')}`;
            const record = records.find(r => r.employeeId === employee.id && r.date === dateStr);
            const dateObj = new Date(dateStr);
            const isSunday = dateObj.getDay() === 0;
            const holiday = isHoliday(dateStr);

            let status = 'ABSENT';
            if (record) status = record.status;
            else if (isSunday) status = 'WEEKLY OFF';
            else if (holiday) status = `HOLIDAY (${holiday.name})`;

            let otDescription = '';
            if (record && (record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.HALF_DAY || record.status === AttendanceStatus.LATE)) {
                if (isSunday || holiday) {
                    const bonusVal = record.status === AttendanceStatus.HALF_DAY ? "0.5" : "1.0";
                    otDescription = `OT Bonus (${bonusVal} Day)`;
                }
            }
            if (record?.overtimeHours) {
                otDescription += otDescription ? ` (+${record.overtimeHours}h)` : `${record.overtimeHours} Hrs`;
            }

            return {
                date: dateStr,
                checkIn: record?.checkIn,
                checkOut: record?.checkOut,
                status,
                lateByMinutes: record?.lateByMinutes,
                otDescription
            };
        });

        exportEmployeePayoutToExcel(
            employee,
            month,
            {
                presentDays: normalWorkedDays + (normalHalfDays * 0.5) + holidayBaseDays,
                otBonusDays,
                totalOTHours,
                totalPaidDays: totalPaidDaysDisplay,
                basicSalary,
                productionAmount: totalProductionAmount,
                overtimeAmount: otEarnings,
                totalDeductions: totalLoanDeduction,
                netSalary
            },
            attendanceData,
            activeLoans,
            user
        );
    };

    // --- PRINT SETTINGS ---
    const [printSettings, setPrintSettings] = useState({
        scale: 'normal' as 'normal' | 'compact',
        showHeader: true
    });
    const [showPrintSettings, setShowPrintSettings] = useState(false);

    const togglePrintSettings = () => setShowPrintSettings(!showPrintSettings);

    const handlePrint = () => {
        window.print();
    };

    return createPortal(
        <div id="print-backdrop" className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div
                id="printable-modal-content"
                className={clsx(
                    "bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]",
                    printSettings.scale === 'compact' ? 'print-compact' : ''
                )}
            >

                {/* Header */}
                <div className="bg-white text-slate-900 border-b-2 border-slate-200 p-6 shrink-0 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold uppercase tracking-tight">Employee Payout – {employee.name}</h2>
                        <div className="text-lg text-slate-500 font-medium mt-1">
                            {new Date(month).toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </div>
                    </div>
                    <div className="flex items-center gap-4 print:hidden relative">
                        {/* Page Setup Menu */}
                        {showPrintSettings && (
                            <div className="absolute top-12 right-0 bg-white shadow-xl border border-slate-200 rounded-lg p-4 w-64 z-50 animate-in fade-in slide-in-from-top-2">
                                <h4 className="font-bold text-slate-700 mb-3 text-sm uppercase">Page Setup</h4>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm text-slate-600">Print Scale</label>
                                        <select
                                            value={printSettings.scale}
                                            onChange={(e) => setPrintSettings({ ...printSettings, scale: e.target.value as 'normal' | 'compact' })}
                                            className="text-sm border rounded px-2 py-1 bg-slate-50"
                                        >
                                            <option value="normal">Normal</option>
                                            <option value="compact">Compact (Fit More)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={togglePrintSettings}
                            className={clsx(
                                "p-2 rounded-lg transition-colors",
                                showPrintSettings ? "bg-blue-100 text-blue-600" : "hover:bg-slate-100 text-slate-400"
                            )}
                            title="Page Setup"
                        >
                            <Settings className="w-5 h-5" />
                        </button>

                        <button
                            onClick={handleExportExcel}
                            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-bold transition-colors border border-green-200"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            EXCEL
                        </button>

                        <button
                            onClick={handlePrint}
                            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors"
                        >
                            <Printer className="w-4 h-4" />
                            PDF / PRINT
                        </button>

                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Info Bar */}
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center text-sm">
                    <div className="font-bold text-slate-700"> Name: <span className="font-normal">{employee.name}</span></div>
                    <div className="font-bold text-slate-700"> Monthly Salary: <span className="font-normal">{employee.basicSalary.toLocaleString()}</span></div>
                </div>

                {/* Scrollable Content Area */}
                <div className="overflow-y-auto flex-1">
                    {/* Financial Summary Section */}
                    <div className="px-6 py-6 bg-gradient-to-br from-slate-50 to-blue-50 border-b-4 border-blue-200">
                        <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                            💰 Financial Passbook
                        </h2>

                        {/* Top-Level Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            {/* Total Loan Taken */}
                            <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-red-500">
                                <div className="text-sm text-slate-500 font-semibold mb-1">Total Loan Taken</div>
                                <div className="text-2xl font-bold text-red-600">₹ {combinedTotalLoan.toLocaleString()}</div>
                            </div>

                            {/* Total Remaining Balance */}
                            <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-orange-500">
                                <div className="text-sm text-slate-500 font-semibold mb-1">Total Remaining</div>
                                <div className="text-2xl font-bold text-orange-600">
                                    ₹ {activeLoans.reduce((sum, l) => sum + l.balance, 0).toLocaleString()}
                                </div>
                            </div>

                            {/* This Month EMI */}
                            <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
                                <div className="text-sm text-slate-500 font-semibold mb-1">This Month EMI</div>
                                <div className="text-2xl font-bold text-blue-600">₹ {totalLoanDeduction.toLocaleString()}</div>
                            </div>
                        </div>

                        {/* Detailed Loan Breakdown */}
                        <div className="bg-white rounded-lg shadow-lg p-6 border border-slate-200">
                            <h3 className="text-lg font-bold text-slate-700 mb-4 border-b pb-2">📊 Loan Breakdown</h3>

                            <div className="space-y-3">
                                {activeLoans.length > 0 ? activeLoans.map((loan) => {
                                    const paidAmount = loan.amount - loan.balance;
                                    const progressPercent = loan.amount > 0 ? (paidAmount / loan.amount) * 100 : 0;
                                    const thisMonthEmi = Math.min(loan.emiAmount, loan.balance);

                                    // Map loan type to readable label
                                    const loanTypeLabel = {
                                        [LoanType.PF_LOAN]: '🏦 PF Loan',
                                        [LoanType.SALARY_PAY]: '💵 Salary Advance',
                                        [LoanType.FOOD]: '🍽️ Food',
                                        [LoanType.ADVANCE_CASH]: '💰 Advance Cash',
                                        [LoanType.FINE]: '⚠️ Fine',
                                        [LoanType.OTHER]: '📌 Other'
                                    }[loan.type] || loan.type;

                                    return (
                                        <div key={loan.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                            {/* Header */}
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <div className="font-bold text-slate-800">{loanTypeLabel}</div>
                                                    <div className="text-xs text-slate-500 mt-1">{loan.reason || 'No remarks'}</div>
                                                    <div className="text-xs text-slate-400">Issued: {formatDate(loan.issuedDate)}</div>
                                                </div>
                                                <div className={clsx(
                                                    "px-3 py-1 rounded-full text-xs font-bold",
                                                    loan.status === 'ACTIVE' ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                                                )}>
                                                    {loan.status}
                                                </div>
                                            </div>

                                            {/* Amount Details */}
                                            <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                                                <div>
                                                    <div className="text-slate-500 text-xs">Total Loan</div>
                                                    <div className="font-bold text-slate-700">₹ {loan.amount.toLocaleString()}</div>
                                                </div>
                                                <div>
                                                    <div className="text-slate-500 text-xs">EMI Amount</div>
                                                    <div className="font-bold text-blue-600">₹ {loan.emiAmount.toLocaleString()}</div>
                                                </div>
                                                <div>
                                                    <div className="text-slate-500 text-xs">Paid So Far</div>
                                                    <div className="font-bold text-green-600">₹ {paidAmount.toLocaleString()}</div>
                                                </div>
                                                <div>
                                                    <div className="text-slate-500 text-xs">Remaining</div>
                                                    <div className="font-bold text-orange-600">₹ {loan.balance.toLocaleString()}</div>
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="mb-2">
                                                <div className="flex justify-between text-xs text-slate-600 mb-1">
                                                    <span>Payment Progress</span>
                                                    <span>{progressPercent.toFixed(1)}%</span>
                                                </div>
                                                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className="bg-gradient-to-r from-green-400 to-green-600 h-full transition-all duration-300"
                                                        style={{ width: `${progressPercent}%` }}
                                                    ></div>
                                                </div>
                                            </div>

                                            {/* This Month Deduction */}
                                            {loan.balance > 0 && (
                                                <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 text-sm">
                                                    <span className="text-slate-600">This Month Deduction:</span>{' '}
                                                    <span className="font-bold text-blue-700">₹ {thisMonthEmi.toLocaleString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }) : (
                                    <div className="text-center py-8 text-slate-400 italic">
                                        ✅ No active loans or advances
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-auto p-6 bg-white text-slate-800">
                        <div className="flex flex-col lg:flex-row gap-8 h-full">

                            {/* LEFT: Loans */}
                            <div className="flex-1 space-y-8">
                                <div>
                                    <h3 className="font-bold text-lg mb-2 text-slate-900 border-b border-slate-200 pb-1">Loan</h3>
                                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-[#2c3e50] text-white">
                                                <tr>
                                                    <th className="px-4 py-2 font-semibold w-24">Date</th>
                                                    <th className="px-4 py-2 font-semibold">Amount</th>
                                                    <th className="px-4 py-2 font-semibold">Remark</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {bigLoans.length > 0 ? bigLoans.map((l) => (
                                                    <tr key={l.id} className="hover:bg-slate-50">
                                                        <td className="px-4 py-2 font-mono text-slate-600">{formatDate(l.issuedDate)}</td>
                                                        <td className="px-4 py-2 font-bold">{l.amount.toLocaleString()}</td>
                                                        <td className="px-4 py-2 text-slate-500 italic">{l.reason}</td>
                                                    </tr>
                                                )) : (
                                                    <tr><td colSpan={3} className="px-4 py-4 text-center text-slate-400 italic">No major loans</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-bold text-lg mb-2 text-slate-900 border-b border-slate-200 pb-1">Other Loan</h3>
                                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-[#2c3e50] text-white">
                                                <tr>
                                                    <th className="px-4 py-2 font-semibold w-24">Date</th>
                                                    <th className="px-4 py-2 font-semibold">Amount</th>
                                                    <th className="px-4 py-2 font-semibold">Remark</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {smallLoans.length > 0 ? smallLoans.map((l) => (
                                                    <tr key={l.id} className="hover:bg-slate-50">
                                                        <td className="px-4 py-2 font-mono text-slate-600">{formatDate(l.issuedDate)}</td>
                                                        <td className="px-4 py-2 font-bold">{l.amount.toLocaleString()}</td>
                                                        <td className="px-4 py-2 text-slate-500 italic">{l.reason}</td>
                                                    </tr>
                                                )) : (
                                                    <tr><td colSpan={3} className="px-4 py-4 text-center text-slate-400 italic">No other advances</td></tr>
                                                )}
                                            </tbody>
                                            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-3 font-bold text-slate-700">
                                                        Total Loan: {combinedTotalLoan.toLocaleString()}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT: Summary */}
                            <div className="w-full lg:w-[350px] shrink-0">
                                <div className="border-2 border-[#2c3e50] rounded-xl overflow-hidden h-fit">
                                    <div className="bg-slate-100 px-5 py-2 text-right border-b border-slate-200">
                                        <span className="text-xs font-bold text-slate-500 uppercase">Per-Day (Auto):</span>
                                        <span className="ml-2 font-bold text-slate-800">
                                            {employee.salaryType === SalaryType.MONTHLY
                                                ? Math.round(employee.basicSalary / daysInMonth)
                                                : employee.paymentRate || 0}
                                        </span>
                                    </div>

                                    <div className="p-6 space-y-8 bg-white">
                                        {/* Summary */}
                                        <div>
                                            <h4 className="font-bold text-lg mb-4 text-slate-900 border-b border-slate-100 pb-2">Summary</h4>
                                            <div className="space-y-3 text-sm">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-600">Total Present (Normal + Offs)</span>
                                                    <span className="font-bold text-slate-900">{normalWorkedDays + (normalHalfDays * 0.5) + holidayBaseDays}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-600">OT (Hours + Bonus Days)</span>
                                                    <span className="font-bold text-slate-900">
                                                        {totalOTHours} Hrs
                                                        {otBonusDays > 0 && (
                                                            <span className="text-blue-600 ml-1">
                                                                + {otBonusDays} Bonus Days
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-600">Total Absent</span>
                                                    <span className="font-bold text-slate-900">{totalAbsent}</span>
                                                </div>
                                                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                                    <span className="font-bold text-slate-700">Total (Paid Days)</span>
                                                    <span className="font-bold text-slate-900">{totalPaidDaysDisplay}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Calculation */}
                                        <div>
                                            <h4 className="font-bold text-lg mb-4 text-slate-900 border-b border-slate-100 pb-2">Calculation</h4>
                                            <div className="space-y-3 text-sm">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-600">Base Salary</span>
                                                    <span className="font-bold text-slate-900">₹{basicSalary.toLocaleString()}</span>
                                                </div>
                                                {otEarnings > 0 && (
                                                    <div className="flex justify-between items-center text-blue-600">
                                                        <span>OT Incentive</span>
                                                        <span className="font-bold">+ ₹{otEarnings.toLocaleString()}</span>
                                                    </div>
                                                )}
                                                {totalProductionAmount > 0 && (
                                                    <div className="flex justify-between items-center text-green-600">
                                                        <span>Production</span>
                                                        <span className="font-bold">+ ₹{totalProductionAmount.toLocaleString()}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center text-red-600">
                                                    <span>Loan Deduction</span>
                                                    <span className="font-bold">- ₹{totalLoanDeduction.toLocaleString()}</span>
                                                </div>

                                                <div className="mt-4 pt-4 border-t-2 border-slate-100">
                                                    <div className="flex justify-between items-baseline">
                                                        <span className="text-sm font-bold text-slate-500">Net Salary</span>
                                                        <span className="text-2xl font-black text-slate-900">₹{netSalary.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Attendance Details Report */}
                        <div className="mt-8 print-break-before">
                            <h3 className="font-bold text-lg mb-2 text-slate-900 border-b border-slate-200 pb-1">Attendance Report</h3>
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-[#dbeafe] text-slate-800">
                                        <tr>
                                            <th className="px-4 py-2 font-semibold w-32 border-r border-[#bfdbfe]">Date</th>
                                            <th className="px-4 py-2 font-semibold w-32 border-r border-[#bfdbfe]">Punch In</th>
                                            <th className="px-4 py-2 font-semibold w-32 border-r border-[#bfdbfe]">Punch Out</th>
                                            <th className="px-4 py-2 font-semibold w-32 border-r border-[#bfdbfe]">Status</th>
                                            <th className="px-4 py-2 font-semibold w-40 border-r border-[#bfdbfe]">Over Time (OT)</th>
                                            <th className="px-4 py-2 font-semibold">Remark</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {Array.from({ length: daysInMonth }, (_, i) => {
                                            const dateStr = `${month}-${String(i + 1).padStart(2, '0')}`;
                                            const record = records.find(r => r.employeeId === employee.id && r.date === dateStr);
                                            const dateObj = new Date(dateStr);
                                            const isSunday = dateObj.getDay() === 0;
                                            const holiday = isHoliday(dateStr);

                                            const formatTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';

                                            let otDescription = '';
                                            if (record && (record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.HALF_DAY || record.status === AttendanceStatus.LATE)) {
                                                if (isSunday || holiday) {
                                                    const bonusVal = record.status === AttendanceStatus.HALF_DAY ? "0.5" : "1.0";
                                                    otDescription = `OT Bonus (${bonusVal} Day)`;
                                                }
                                            }
                                            if (record?.overtimeHours) {
                                                otDescription += otDescription ? ` (+${record.overtimeHours}h)` : `${record.overtimeHours} Hrs`;
                                            }

                                            return (
                                                <tr key={dateStr} className={clsx("hover:bg-slate-50", isSunday && !record ? "bg-red-50/50" : "")}>
                                                    <td className="px-4 py-1.5 font-mono text-slate-600 border-r border-slate-100">
                                                        {dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                                    </td>
                                                    <td className="px-4 py-1.5 font-mono text-slate-600 border-r border-slate-100">
                                                        {formatTime(record?.checkIn)}
                                                    </td>
                                                    <td className="px-4 py-1.5 font-mono text-slate-600 border-r border-slate-100">
                                                        {formatTime(record?.checkOut)}
                                                    </td>
                                                    <td className="px-4 py-1.5 border-r border-slate-100">
                                                        {record ? (
                                                            <span className={clsx(
                                                                "font-bold text-xs uppercase px-2 py-0.5 rounded",
                                                                record.status === AttendanceStatus.PRESENT ? "bg-green-100 text-green-700" :
                                                                    record.status === AttendanceStatus.ABSENT ? "bg-red-100 text-red-700" :
                                                                        record.status === AttendanceStatus.HALF_DAY ? "bg-yellow-100 text-yellow-700" :
                                                                            "bg-slate-100 text-slate-500"
                                                            )}>
                                                                {record.status}
                                                            </span>
                                                        ) : isSunday ? <span className="text-red-400 text-xs font-bold uppercase">Weekly Off</span> :
                                                            holiday ? <span className="text-orange-400 text-xs font-bold uppercase">{holiday.name}</span> : ''
                                                        }
                                                    </td>
                                                    <td className="px-4 py-1.5 border-r border-slate-100 font-bold text-xs text-blue-600">
                                                        {otDescription}
                                                    </td>
                                                    <td className="px-4 py-1.5 text-slate-500 italic text-xs">
                                                        {record?.lateByMinutes ? <span className="text-red-500 mr-2">Late: {record.lateByMinutes}m</span> : ''}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 p-3 text-center border-t border-slate-200 shrink-0">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Generated by SM Payroll System</p>
            </div>
        </div>,
        document.body
    );
};
