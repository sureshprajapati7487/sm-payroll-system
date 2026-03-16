import { useState } from 'react';
import { FileText, Download, Columns, Calendar, RefreshCw } from 'lucide-react';
import { useAttendanceStore } from '@/store/attendanceStore';
import { usePayrollStore } from '@/store/payrollStore';
import { useLoanStore } from '@/store/loanStore';
import { useProductionStore } from '@/store/productionStore';
import { useLeaveStore } from '@/store/leaveStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { useAuthStore } from '@/store/authStore';
import { PERMISSIONS } from '@/config/permissions';
import { useAuditStore } from '@/store/auditStore';
import { useSecurityStore } from '@/store/securityStore';

// ── Report type definitions with field mappings ───────────────────────────────
const REPORT_TYPES = [
    {
        id: 'ATTENDANCE',
        label: 'Attendance Report',
        columns: ['Date', 'Employee', 'Code', 'Department', 'Status', 'In Time', 'Out Time', 'Late By (min)', 'OT Hours'],
    },
    {
        id: 'PAYROLL',
        label: 'Payroll Report',
        columns: ['Month', 'Employee', 'Code', 'Department', 'Basic', 'Allowances', 'Production', 'Overtime', 'Gross', 'Loan Deduction', 'PF', 'Tax', 'Other Deductions', 'Total Deductions', 'Net Salary', 'Status'],
    },
    {
        id: 'LOAN',
        label: 'Loan Report',
        columns: ['Employee', 'Code', 'Type', 'Amount', 'EMI', 'Balance', 'Issued Date', 'Tenure (Months)', 'Status'],
    },
    {
        id: 'PRODUCTION',
        label: 'Production Report',
        columns: ['Date', 'Employee', 'Code', 'Department', 'Item', 'Quantity', 'Rate', 'Total Amount', 'Status'],
    },
    {
        id: 'LEAVE',
        label: 'Leave Report',
        columns: ['Employee', 'Code', 'Type', 'From', 'To', 'Days', 'Reason', 'Applied On', 'Status'],
    },
    {
        id: 'EXPENSE',
        label: 'Expense Report',
        columns: ['Date', 'Category', 'Description', 'Amount', 'Paid To', 'Added By', 'Status'],
    },
];

export const ReportBuilder = () => {
    const [reportType, setReportType] = useState('ATTENDANCE');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
    const [generatedReport, setGeneratedReport] = useState<any[] | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const { hasPermission, user } = useAuthStore();
    const canExport = hasPermission(PERMISSIONS.EXPORT_REPORTS);
    const addLog = useAuditStore(s => s.addLog);
    const { currentIp } = useSecurityStore();

    // Store data
    const { records: attendanceRecords } = useAttendanceStore();
    const { slips: payrollSlips } = usePayrollStore();
    const { loans } = useLoanStore();
    const { entries: productionEntries } = useProductionStore();
    const { requests: leaveRequests } = useLeaveStore();
    const { employees } = useEmployeeStore();
    const { currentCompanyId } = useMultiCompanyStore();

    const currentType = REPORT_TYPES.find(t => t.id === reportType);

    // Helper: get employee by ID
    const getEmp = (id: string) => employees.find(e => e.id === id);

    // Helper: filter by date range
    const inRange = (dateStr: string) => {
        if (!dateRange.start && !dateRange.end) return true;
        if (dateRange.start && dateStr < dateRange.start) return false;
        if (dateRange.end && dateStr > dateRange.end) return false;
        return true;
    };

    const toggleColumn = (col: string) => {
        setSelectedColumns(prev =>
            prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
        );
    };

    const selectAll = () => setSelectedColumns(currentType?.columns || []);
    const clearAll = () => setSelectedColumns([]);

    // ── Real data generation ──────────────────────────────────────────────────
    const generateRealData = (): any[] => {
        switch (reportType) {
            case 'ATTENDANCE': {
                const filtered = attendanceRecords.filter(r => {
                    if (currentCompanyId) {
                        const emp = getEmp(r.employeeId);
                        if (emp && emp.companyId !== currentCompanyId) return false;
                    }
                    return inRange(r.date);
                });
                return filtered.map(r => {
                    const emp = getEmp(r.employeeId);
                    return {
                        'Date': r.date,
                        'Employee': emp?.name || r.employeeId,
                        'Code': emp?.code || '—',
                        'Department': emp?.department || '—',
                        'Status': r.status,
                        'In Time': r.checkIn ? new Date(r.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—',
                        'Out Time': r.checkOut ? new Date(r.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—',
                        'Late By (min)': r.lateByMinutes || 0,
                        'OT Hours': r.overtimeHours || 0,
                    };
                });
            }

            case 'PAYROLL': {
                const filtered = payrollSlips.filter(s => {
                    if (currentCompanyId && s.companyId !== currentCompanyId) return false;
                    const monthStart = s.month + '-01';
                    return inRange(monthStart);
                });
                return filtered.map(s => {
                    const emp = getEmp(s.employeeId);
                    return {
                        'Month': s.month,
                        'Employee': emp?.name || s.employeeId,
                        'Code': emp?.code || '—',
                        'Department': emp?.department || '—',
                        'Basic': s.basicSalary,
                        'Allowances': s.allowances,
                        'Production': s.productionAmount,
                        'Overtime': s.overtimeAmount,
                        'Gross': s.grossSalary,
                        'Loan Deduction': s.loanDeduction,
                        'PF': s.pfDeduction,
                        'Tax': s.taxDeduction,
                        'Other Deductions': s.otherDeduction,
                        'Total Deductions': s.totalDeductions,
                        'Net Salary': s.netSalary,
                        'Status': s.status,
                    };
                });
            }

            case 'LOAN': {
                const filtered = loans.filter(l => {
                    if (currentCompanyId && l.companyId !== currentCompanyId) return false;
                    return inRange(l.issuedDate || '');
                });
                return filtered.map(l => {
                    const emp = getEmp(l.employeeId);
                    return {
                        'Employee': emp?.name || l.employeeId,
                        'Code': emp?.code || '—',
                        'Type': l.type,
                        'Amount': l.amount,
                        'EMI': l.emiAmount,
                        'Balance': l.balance,
                        'Issued Date': l.issuedDate || '—',
                        'Tenure (Months)': l.tenureMonths,
                        'Status': l.status,
                    };
                });
            }

            case 'PRODUCTION': {
                const filtered = productionEntries.filter(p => {
                    if (currentCompanyId && p.companyId !== currentCompanyId) return false;
                    return inRange(p.date);
                });
                return filtered.map(p => {
                    const emp = getEmp(p.employeeId);
                    return {
                        'Date': p.date,
                        'Employee': emp?.name || p.employeeId,
                        'Code': emp?.code || '—',
                        'Department': emp?.department || '—',
                        'Item': p.item,
                        'Quantity': p.qty,
                        'Rate': p.rate,
                        'Total Amount': p.totalAmount,
                        'Status': p.status,
                    };
                });
            }

            case 'LEAVE': {
                const filtered = leaveRequests.filter(r => {
                    if (currentCompanyId && (r as any).companyId && (r as any).companyId !== currentCompanyId) return false;
                    return inRange(r.startDate);
                });
                return filtered.map(r => {
                    const emp = getEmp(r.employeeId);
                    return {
                        'Employee': emp?.name || r.employeeId,
                        'Code': emp?.code || '—',
                        'Type': r.type,
                        'From': r.startDate,
                        'To': r.endDate,
                        'Days': r.daysCount || '—',
                        'Reason': r.reason || '—',
                        'Applied On': r.appliedOn,
                        'Status': r.status,
                    };
                });
            }

            default:
                return [];
        }
    };

    const handleGenerate = () => {
        setIsGenerating(true);
        setTimeout(() => {
            const data = generateRealData();
            setGeneratedReport(data);
            setIsGenerating(false);
        }, 300);
    };

    // ── CSV Export with proper escaping ──────────────────────────────────────
    const exportCSV = () => {
        if (!generatedReport || generatedReport.length === 0) return;

        if (user) {
            addLog({
                userId: user.id,
                userName: user.name,
                userRole: user.role,
                action: 'DATA_EXPORT',
                entityType: 'SETTINGS',
                details: {
                    reportType: currentType?.label || 'Custom',
                    rows: generatedReport.length,
                    dateRange
                },
                ipAddress: currentIp || '127.0.0.1',
                userAgent: navigator.userAgent,
                status: 'SUCCESS'
            });
        }

        const cols = selectedColumns.length > 0 ? selectedColumns : (currentType?.columns || []);
        const escape = (v: any) => {
            const s = String(v ?? '');
            return s.includes(',') || s.includes('"') || s.includes('\n')
                ? `"${s.replace(/"/g, '""')}"`
                : s;
        };
        const headers = cols.join(',');
        const rows = generatedReport.map(row => cols.map(col => escape(row[col])).join(','));
        const footerInfo = [
            '',
            `"CONFIDENTIAL \— ${user?.role || 'System'} DATA"`,
            `"Downloaded by ${user?.name || 'Automated'} (${user?.id || 'System'}) on ${new Date().toLocaleString()}"`
        ];
        const csv = [headers, ...rows, ...footerInfo].join('\n');
        const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
        const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType.toLowerCase()}_report_${dateRange.start || 'all'}_to_${dateRange.end || 'all'}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const displayCols = selectedColumns.length > 0 ? selectedColumns : (currentType?.columns || []);
    const totalRows = generatedReport?.length || 0;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <FileText className="w-8 h-8 text-primary-500" />
                        Custom Report Builder
                    </h1>
                    <p className="text-dark-muted mt-1">Generate real-time reports from live data</p>
                </div>
                {generatedReport && (
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <span className="text-dark-muted text-sm">{totalRows} records</span>
                        {canExport && (
                            <button
                                onClick={exportCSV}
                                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-xl transition-all"
                            >
                                <Download className="w-4 h-4" />
                                Export CSV
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full min-w-0 max-w-full">
                {/* ── Config Panel ── */}
                <div className="glass rounded-2xl p-6 space-y-5">
                    {/* Report Type */}
                    <div>
                        <label className="block text-sm font-medium text-white mb-2">Report Type</label>
                        <select
                            value={reportType}
                            onChange={(e) => {
                                setReportType(e.target.value);
                                setSelectedColumns([]);
                                setGeneratedReport(null);
                            }}
                            className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white"
                        >
                            {REPORT_TYPES.map(t => (
                                <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date Range */}
                    <div>
                        <label className="block text-sm font-medium text-white mb-2 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Date Range <span className="text-dark-muted font-normal text-xs">(optional)</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                                className="bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-white text-sm"
                            />
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                                className="bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-white text-sm"
                            />
                        </div>
                        {(dateRange.start || dateRange.end) && (
                            <button
                                onClick={() => setDateRange({ start: '', end: '' })}
                                className="text-xs text-dark-muted hover:text-white mt-1 transition-colors"
                            >
                                ✕ Clear range
                            </button>
                        )}
                    </div>

                    {/* Columns */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-white flex items-center gap-2">
                                <Columns className="w-4 h-4" />
                                Columns
                            </label>
                            <div className="flex gap-2 text-xs">
                                <button onClick={selectAll} className="text-primary-400 hover:text-primary-300">All</button>
                                <span className="text-dark-border">|</span>
                                <button onClick={clearAll} className="text-dark-muted hover:text-white">None</button>
                            </div>
                        </div>
                        <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
                            {currentType?.columns.map(col => (
                                <label key={col} className="flex items-center gap-3 p-2.5 bg-dark-surface rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={selectedColumns.includes(col)}
                                        onChange={() => toggleColumn(col)}
                                        className="w-4 h-4 rounded border-dark-border bg-dark-bg text-primary-500 focus:ring-primary-500"
                                    />
                                    <span className="text-white text-sm">{col}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="w-full bg-gradient-to-r from-primary-600 to-blue-600 disabled:opacity-60 hover:from-primary-500 hover:to-blue-500 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2"
                    >
                        {isGenerating ? (
                            <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</>
                        ) : (
                            <><FileText className="w-4 h-4" /> Generate Report</>
                        )}
                    </button>
                </div>

                {/* ── Preview Panel ── */}
                <div className="lg:col-span-2 glass rounded-2xl p-6 min-h-[500px] min-w-0 max-w-full w-full">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            {generatedReport ? `${currentType?.label} — ${totalRows} records` : 'Report Preview'}
                        </h3>
                        {generatedReport && totalRows === 0 && (
                            <span className="text-xs text-yellow-400 bg-yellow-500/10 px-3 py-1 rounded-full">
                                No data in selected range
                            </span>
                        )}
                    </div>

                    {!generatedReport ? (
                        <div className="h-[400px] flex flex-col items-center justify-center text-dark-muted gap-3 opacity-50">
                            <FileText className="w-16 h-16" />
                            <p>Select report type and click Generate</p>
                            <p className="text-xs">Data pulls from live stores: Attendance, Payroll, Loans, Production, Leave</p>
                        </div>
                    ) : generatedReport.length === 0 ? (
                        <div className="h-[400px] flex flex-col items-center justify-center text-dark-muted gap-3 opacity-50">
                            <FileText className="w-12 h-12" />
                            <p>No records found for the selected filters</p>
                            <button onClick={() => setDateRange({ start: '', end: '' })} className="text-primary-400 text-sm hover:underline">
                                Clear date range and try again
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto overflow-y-auto max-h-[500px] w-full">
                            <table className="w-full text-sm">
                                <thead className="bg-dark-bg sticky top-0 z-10">
                                    <tr>
                                        <th className="text-left p-3 text-dark-muted font-medium text-xs whitespace-nowrap">#</th>
                                        {displayCols.map(col => (
                                            <th key={col} className="text-left p-3 text-dark-muted font-medium text-xs whitespace-nowrap uppercase tracking-wide">
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {generatedReport.map((row, i) => (
                                        <tr key={i} className="border-b border-dark-border hover:bg-white/5 transition-colors">
                                            <td className="p-3 text-dark-muted text-xs">{i + 1}</td>
                                            {displayCols.map(col => {
                                                const val = row[col];
                                                const isAmount = typeof val === 'number' && ['Amount', 'Basic', 'Gross', 'Net Salary', 'Total Amount', 'EMI', 'Balance', 'Allowances', 'Production', 'Overtime'].some(k => col.includes(k));
                                                const isStatus = col === 'Status';
                                                const statusColors: Record<string, string> = {
                                                    PRESENT: 'text-green-400', ABSENT: 'text-red-400',
                                                    APPROVED: 'text-green-400', REJECTED: 'text-red-400',
                                                    PENDING: 'text-yellow-400', ACTIVE: 'text-blue-400',
                                                    PAID: 'text-emerald-400', GENERATED: 'text-purple-400',
                                                };
                                                return (
                                                    <td key={col} className="p-3 whitespace-nowrap">
                                                        {isAmount ? (
                                                            <span className="font-mono text-white">₹{Number(val).toLocaleString('en-IN')}</span>
                                                        ) : isStatus ? (
                                                            <span className={`text-xs font-semibold ${statusColors[String(val)] || 'text-white'}`}>{val}</span>
                                                        ) : (
                                                            <span className="text-white">{String(val ?? '—')}</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
