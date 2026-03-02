// DataConsistencyChecker — Real store checks + working auto-fix actions
import { useState, useCallback } from 'react';
import {
    Shield, AlertTriangle, CheckCircle, RefreshCw, Zap, Loader2,
    Clock, Users, Banknote, Calendar, TrendingUp, XCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { useEmployeeStore } from '@/store/employeeStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { usePayrollStore } from '@/store/payrollStore';
import { useLoanStore } from '@/store/loanStore';
import { useLeaveStore } from '@/store/leaveStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { LoanStatus, LeaveStatus } from '@/types';

type Severity = 'critical' | 'high' | 'medium' | 'low';
type Category = 'payroll' | 'attendance' | 'employee' | 'loan' | 'leave';

interface IssueDetail { label: string; value: string; }
interface ConsistencyIssue {
    id: string;
    severity: Severity;
    category: Category;
    title: string;
    description: string;
    affectedRecords: number;
    autoFixable: boolean;
    details?: IssueDetail[];
    fixLabel?: string;
    fix?: () => Promise<void> | void;
}

const SEV_COLORS: Record<Severity, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};
const CAT_ICONS: Record<Category, React.ReactNode> = {
    payroll: <Banknote className="w-4 h-4" />,
    attendance: <Clock className="w-4 h-4" />,
    employee: <Users className="w-4 h-4" />,
    loan: <TrendingUp className="w-4 h-4" />,
    leave: <Calendar className="w-4 h-4" />,
};

export const DataConsistencyChecker = () => {
    const { employees } = useEmployeeStore();
    const { records: attendanceRecords, markCheckOut } = useAttendanceStore();
    const { slips } = usePayrollStore();
    const { loans } = useLoanStore();
    const { requests: leaves, rejectLeave } = useLeaveStore();
    const { currentCompanyId } = useMultiCompanyStore();

    const [checking, setChecking] = useState(false);
    const [issues, setIssues] = useState<ConsistencyIssue[]>([]);
    const [lastCheck, setLastCheck] = useState<string | null>(null);
    const [fixing, setFixing] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [fixLog, setFixLog] = useState<Array<{ id: string; msg: string; ok: boolean }>>([]);

    const toggleExpand = (id: string) => setExpanded(prev => {
        const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
    });

    const runCheck = useCallback(() => {
        setChecking(true);
        setFixLog([]);
        const scopedEmps = currentCompanyId ? employees.filter(e => e.companyId === currentCompanyId) : employees;
        const empIds = new Set(scopedEmps.map(e => e.id));
        const today = new Date().toISOString().slice(0, 10);
        const found: ConsistencyIssue[] = [];

        // 1 Negative salary
        const negSlips = slips.filter(s => empIds.has(s.employeeId) && ((s.netSalary ?? 0) < 0 || (s.grossSalary ?? 0) < 0));
        if (negSlips.length) found.push({
            id: 'neg_salary', severity: 'critical', category: 'payroll',
            title: 'Negative Salary Values',
            description: `${negSlips.length} slip(s) have negative gross or net salary.`,
            affectedRecords: negSlips.length, autoFixable: false,
            details: negSlips.slice(0, 5).map(s => ({ label: scopedEmps.find(e => e.id === s.employeeId)?.name || s.employeeId, value: `Net:Rs.${s.netSalary} Gross:Rs.${s.grossSalary} (${s.month})` })),
        });

        // 2 Orphaned payroll
        const orphanSlips = slips.filter(s => !employees.find(e => e.id === s.employeeId));
        if (orphanSlips.length) found.push({
            id: 'orphan_slips', severity: 'high', category: 'payroll',
            title: 'Orphaned Payroll Records',
            description: `${orphanSlips.length} slip(s) have no matching employee.`,
            affectedRecords: orphanSlips.length, autoFixable: false,
            details: orphanSlips.slice(0, 5).map(s => ({ label: s.employeeId, value: `${s.month} | Net: Rs.${s.netSalary ?? 0}` })),
        });

        // 3 Zero salary active employees
        const zeroSalaryEmps = scopedEmps.filter(e => e.status === 'ACTIVE' && !(e.basicSalary ?? 0) && !(e.paymentRate ?? 0));
        if (zeroSalaryEmps.length) found.push({
            id: 'zero_salary', severity: 'high', category: 'employee',
            title: 'Active Employees with Rs.0 Salary',
            description: `${zeroSalaryEmps.length} active employee(s) have no salary configured.`,
            affectedRecords: zeroSalaryEmps.length, autoFixable: false,
            details: zeroSalaryEmps.slice(0, 5).map(e => ({ label: e.name, value: `Code: ${e.code} | Dept: ${e.department || 'N/A'}` })),
        });

        // 4 Duplicate codes
        const codeCount: Record<string, number> = {};
        scopedEmps.forEach(e => { if (e.code) codeCount[e.code] = (codeCount[e.code] || 0) + 1; });
        const dupCodes = Object.entries(codeCount).filter(([, c]) => c > 1);
        if (dupCodes.length) found.push({
            id: 'dup_codes', severity: 'critical', category: 'employee',
            title: 'Duplicate Employee Codes',
            description: `${dupCodes.length} code(s) assigned to multiple employees.`,
            affectedRecords: dupCodes.reduce((a, [, c]) => a + c, 0), autoFixable: false,
            details: dupCodes.slice(0, 5).map(([code, c]) => ({ label: `Code: ${code}`, value: `${c} employees share this code` })),
        });

        // 5 Missing checkout today (AUTO-FIXABLE)
        const missingCheckout = attendanceRecords.filter(r => empIds.has(r.employeeId) && r.date === today && r.checkIn && !r.checkOut);
        if (missingCheckout.length) found.push({
            id: 'missing_checkout', severity: 'medium', category: 'attendance',
            title: 'Missing Check-Out (Today)',
            description: `${missingCheckout.length} employee(s) have not checked out today.`,
            affectedRecords: missingCheckout.length, autoFixable: true, fixLabel: 'Set check-out to now',
            details: missingCheckout.slice(0, 5).map(r => ({ label: scopedEmps.find(e => e.id === r.employeeId)?.name || r.employeeId, value: `In: ${r.checkIn}` })),
            fix: async () => { for (const rec of missingCheckout) await markCheckOut(rec.employeeId); },
        });

        // 6 Orphaned attendance
        const orphanAtt = attendanceRecords.filter(r => !employees.find(e => e.id === r.employeeId));
        if (orphanAtt.length) found.push({
            id: 'orphan_attendance', severity: 'medium', category: 'attendance',
            title: 'Orphaned Attendance Records',
            description: `${orphanAtt.length} attendance record(s) have no matching employee.`,
            affectedRecords: orphanAtt.length, autoFixable: false,
            details: orphanAtt.slice(0, 5).map(r => ({ label: r.employeeId, value: `Date: ${r.date}` })),
        });

        // 7 Loans exceeding 24-month salary
        const excessLoans = loans.filter(l => {
            const emp = employees.find(e => e.id === l.employeeId);
            if (!emp) return false;
            const sal = (emp.basicSalary || 0) + (emp.paymentRate || 0);
            return sal > 0 && l.amount > sal * 24;
        });
        if (excessLoans.length) found.push({
            id: 'excessive_loans', severity: 'high', category: 'loan',
            title: 'Loans Exceeding 24-Month Salary',
            description: `${excessLoans.length} loan(s) exceed 2 years of employee salary.`,
            affectedRecords: excessLoans.length, autoFixable: false,
            details: excessLoans.slice(0, 5).map(l => { const emp = employees.find(e => e.id === l.employeeId); return { label: emp?.name || l.employeeId, value: `Loan: Rs.${l.amount.toLocaleString()}` }; }),
        });

        // 8 Approved loans with 0 EMI
        const zeroEmi = loans.filter(l => l.status === LoanStatus.ACTIVE && !(l.emiAmount ?? 0));
        if (zeroEmi.length) found.push({
            id: 'zero_emi', severity: 'medium', category: 'loan',
            title: 'Approved Loans with Rs.0 EMI',
            description: `${zeroEmi.length} approved loan(s) have no EMI configured.`,
            affectedRecords: zeroEmi.length, autoFixable: false,
            details: zeroEmi.slice(0, 5).map(l => { const emp = employees.find(e => e.id === l.employeeId); return { label: emp?.name || l.employeeId, value: `Rs.${l.amount?.toLocaleString()} | ${l.tenureMonths}m` }; }),
        });

        // 9 Stale pending leaves >15d
        const stale = (leaves ?? []).filter(l => {
            if (l.status !== LeaveStatus.PENDING) return false;
            return (Date.now() - new Date(l.appliedOn || l.startDate).getTime()) / 86400000 > 15;
        });
        if (stale.length) found.push({
            id: 'stale_leaves', severity: 'medium', category: 'leave',
            title: 'Leave Requests Pending >15 Days',
            description: `${stale.length} leave request(s) pending for over 15 days.`,
            affectedRecords: stale.length, autoFixable: false,
            details: stale.slice(0, 5).map(l => { const emp = employees.find(e => e.id === l.employeeId); const d = Math.floor((Date.now() - new Date(l.appliedOn || l.startDate).getTime()) / 86400000); return { label: emp?.name || l.employeeId, value: `${l.type} | ${d}d pending` }; }),
        });

        // 10 Inactive employees with pending leaves (AUTO-FIXABLE)
        const inactLeaves = (leaves ?? []).filter(l => l.status === LeaveStatus.PENDING && employees.find(e => e.id === l.employeeId)?.status === 'INACTIVE');
        if (inactLeaves.length) found.push({
            id: 'inactive_leaves', severity: 'low', category: 'leave',
            title: 'Inactive Employees with Pending Leaves',
            description: `${inactLeaves.length} pending leave(s) belong to inactive employees.`,
            affectedRecords: inactLeaves.length, autoFixable: true, fixLabel: 'Auto-reject all',
            details: inactLeaves.slice(0, 5).map(l => { const emp = employees.find(e => e.id === l.employeeId); return { label: emp?.name || l.employeeId, value: `${l.type} | ${l.startDate}` }; }),
            fix: async () => { for (const l of inactLeaves) await rejectLeave(l.id); },
        });

        // 11 Active employees missing department
        const noDept = scopedEmps.filter(e => e.status === 'ACTIVE' && !e.department);
        if (noDept.length) found.push({
            id: 'no_dept', severity: 'low', category: 'employee',
            title: 'Active Employees Missing Department',
            description: `${noDept.length} active employee(s) have no department assigned.`,
            affectedRecords: noDept.length, autoFixable: false,
            details: noDept.slice(0, 5).map(e => ({ label: e.name, value: `Code: ${e.code}` })),
        });

        const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        found.sort((a, b) => order[a.severity] - order[b.severity]);
        setIssues(found);
        setLastCheck(new Date().toISOString());
        setChecking(false);
    }, [employees, attendanceRecords, slips, loans, leaves, currentCompanyId, markCheckOut, rejectLeave]);

    const handleFix = async (issue: ConsistencyIssue) => {
        if (!issue.fix) return;
        setFixing(issue.id);
        try {
            await issue.fix();
            setFixLog(prev => [...prev, { id: issue.id, msg: `"${issue.title}" fixed`, ok: true }]);
            setIssues(prev => prev.filter(i => i.id !== issue.id));
        } catch (e: any) {
            setFixLog(prev => [...prev, { id: issue.id, msg: `Fix failed: ${e.message}`, ok: false }]);
        }
        setFixing(null);
    };
    const handleFixAll = async () => { for (const i of issues.filter(i => i.autoFixable && i.fix)) await handleFix(i); };

    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const highCount = issues.filter(i => i.severity === 'high').length;
    const autoFixableCount = issues.filter(i => i.autoFixable).length;

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Shield className="w-8 h-8 text-primary-500" /> Data Consistency Checker
                    </h1>
                    <p className="text-dark-muted mt-1">Real-time data integrity checks across all modules</p>
                </div>
                <div className="flex gap-3">
                    {issues.length > 0 && autoFixableCount > 0 && (
                        <button onClick={handleFixAll} disabled={!!fixing} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-semibold text-sm">
                            <Zap className="w-4 h-4" /> Fix All ({autoFixableCount})
                        </button>
                    )}
                    <button onClick={runCheck} disabled={checking} className="bg-gradient-to-r from-primary-600 to-blue-600 hover:brightness-110 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2">
                        {checking ? <><Loader2 className="w-5 h-5 animate-spin" /> Checking…</> : <><RefreshCw className="w-5 h-5" /> Run Check</>}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Issues', value: issues.length, color: 'text-white' },
                    { label: 'Critical', value: criticalCount, color: 'text-red-400' },
                    { label: 'High Priority', value: highCount, color: 'text-orange-400' },
                    { label: 'Auto-Fixable', value: autoFixableCount, color: 'text-green-400' },
                ].map(s => (
                    <div key={s.label} className="glass rounded-2xl p-5">
                        <p className="text-dark-muted text-sm">{s.label}</p>
                        <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {lastCheck && (
                <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm">
                    <span className="text-blue-400">Last check: {new Date(lastCheck).toLocaleString('en-IN')}</span>
                    <span className="text-slate-500">{issues.length === 0 ? '✅ All clear' : `${issues.length} issue(s) found`}</span>
                </div>
            )}

            {fixLog.length > 0 && (
                <div className="glass rounded-2xl p-4 space-y-1.5">
                    <p className="text-xs font-semibold text-slate-400 mb-2">Fix Log</p>
                    {fixLog.map((entry, i) => (
                        <p key={i} className={`text-xs flex items-center gap-1.5 ${entry.ok ? 'text-green-400' : 'text-red-400'}`}>
                            {entry.ok ? <CheckCircle className="w-3 h-3 shrink-0" /> : <XCircle className="w-3 h-3 shrink-0" />}
                            {entry.ok ? '✅' : '❌'} {entry.msg}
                        </p>
                    ))}
                </div>
            )}

            <div className="glass rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-dark-border flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Detected Issues</h3>
                    {issues.length > 0 && <span className="text-xs text-slate-500">{issues.length} issue(s) • click ▾ for details</span>}
                </div>
                {issues.length === 0 ? (
                    <div className="p-12 text-center">
                        {!lastCheck ? (
                            <>
                                <Shield className="w-16 h-16 mx-auto mb-4 text-dark-muted opacity-20" />
                                <p className="text-lg text-dark-muted">No checks run yet</p>
                                <p className="text-sm text-dark-muted mt-2">Click "Run Check" to begin</p>
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
                                <p className="text-lg text-white font-semibold">All Clear! ✅</p>
                                <p className="text-sm text-dark-muted mt-2">No data consistency issues detected</p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-dark-border">
                        {issues.map(issue => (
                            <div key={issue.id} className="hover:bg-white/[0.02] transition-all">
                                <div className="p-5 flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                            <AlertTriangle className={`w-4 h-4 shrink-0 ${issue.severity === 'critical' ? 'text-red-400' : issue.severity === 'high' ? 'text-orange-400' : issue.severity === 'medium' ? 'text-yellow-400' : 'text-blue-400'}`} />
                                            <h4 className="text-white font-semibold text-sm">{issue.title}</h4>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${SEV_COLORS[issue.severity]}`}>{issue.severity.toUpperCase()}</span>
                                            <span className="px-2 py-0.5 bg-dark-surface text-slate-500 rounded-full text-[10px] flex items-center gap-1">{CAT_ICONS[issue.category]} {issue.category}</span>
                                            {issue.autoFixable && <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full text-[10px] flex items-center gap-1"><Zap className="w-2.5 h-2.5" /> auto-fixable</span>}
                                        </div>
                                        <p className="text-dark-muted text-sm">{issue.description}</p>
                                        <p className="text-xs text-slate-600 mt-0.5">{issue.affectedRecords} affected record{issue.affectedRecords !== 1 ? 's' : ''}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {issue.autoFixable && issue.fix && (
                                            <button onClick={() => handleFix(issue)} disabled={fixing === issue.id}
                                                className="flex items-center gap-1.5 bg-green-500/15 hover:bg-green-500/25 text-green-400 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
                                                {fixing === issue.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                                                {issue.fixLabel || 'Auto-Fix'}
                                            </button>
                                        )}
                                        {issue.details && (
                                            <button onClick={() => toggleExpand(issue.id)} className="text-slate-500 hover:text-white p-1.5 rounded-lg transition-colors">
                                                {expanded.has(issue.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {expanded.has(issue.id) && issue.details && (
                                    <div className="px-5 pb-4">
                                        <div className="bg-dark-surface rounded-xl overflow-hidden divide-y divide-slate-800/50">
                                            {issue.details.map((d, i) => (
                                                <div key={i} className="flex justify-between px-4 py-2.5 text-xs">
                                                    <span className="text-white font-medium">{d.label}</span>
                                                    <span className="text-slate-400">{d.value}</span>
                                                </div>
                                            ))}
                                            {issue.affectedRecords > 5 && <div className="px-4 py-2 text-xs text-slate-600 italic">+{issue.affectedRecords - 5} more…</div>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="glass rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-white">11 Checks Performed</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-500">
                    {['🔴 Negative salary values', '🔴 Duplicate employee codes', '🟠 Orphaned payroll slips', '🟠 Active employees with Rs.0 salary', '🟠 Loans exceeding 24-month salary', '🟠 Approved loans with Rs.0 EMI', '🟡 Missing check-out today [auto-fix]', '🟡 Orphaned attendance records', '🟡 Leave requests pending >15 days', '🔵 Inactive employees with pending leaves [auto-fix]', '🔵 Active employees missing department'].map((c, i) => <p key={i}>{c}</p>)}
                </div>
            </div>
        </div>
    );
};
