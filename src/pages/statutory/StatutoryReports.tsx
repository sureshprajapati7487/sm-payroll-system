// StatutoryReports — live data from payrollStore + real CSV exports
import { useState, useMemo } from 'react';
import { Download, Building, Shield, TrendingUp, Calendar, Users, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import { useEmployeeStore } from '@/store/employeeStore';
import { usePayrollStore } from '@/store/payrollStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// PF: 12% employee, 12% employer (8.33% EPS + 3.67% EPF)
const PF_RATE = 0.12;
const EPS_RATE = 0.0833;
const EPF_EMP_RATE = 0.0367;
const PF_CEILING = 15000; // PF ceiling on basic

// ESI: 0.75% employee, 3.25% employer on gross salary  (applicable if salary ≤ ₹21,000)
const ESI_EMP_RATE = 0.0075;
const ESI_EMP_RATE_EMPLOYER = 0.0325;
const ESI_CEILING = 21000;

// Professional Tax slabs (Maharashtra — most common)
function getPT(grossMonthly: number): number {
    if (grossMonthly <= 7500) return 0;
    if (grossMonthly <= 10000) return 175;
    return 200; // ₹300 in Feb, simplified as ₹200/month
}

type ReportType = 'PF' | 'ESI' | 'PT';

function downloadCSV(filename: string, rows: string[][]) {
    const bom = '\uFEFF';
    const csv = bom + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

export const StatutoryReports = () => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [reportType, setReportType] = useState<ReportType>('PF');

    const { employees } = useEmployeeStore();
    const { slips } = usePayrollStore();
    const { currentCompanyId, companies } = useMultiCompanyStore();

    const company = companies.find(c => c.id === currentCompanyId);

    // Compute per-employee statutory details for selected month
    const monthSlips = useMemo(() => {
        return slips.filter(s =>
            s.month === selectedMonth &&
            (!currentCompanyId || s.companyId === currentCompanyId)
        );
    }, [slips, selectedMonth, currentCompanyId]);

    const empMap = useMemo(() => {
        const m: Record<string, typeof employees[0]> = {};
        employees.forEach(e => { m[e.id] = e; });
        return m;
    }, [employees]);

    // PF details
    const pfRows = useMemo(() => monthSlips.map(slip => {
        const emp = empMap[slip.employeeId];
        const pfBasic = Math.min(slip.basicSalary || 0, PF_CEILING);
        const empContrib = Math.round(pfBasic * PF_RATE);
        const epsContrib = Math.round(pfBasic * EPS_RATE);
        const epfContrib = Math.round(pfBasic * EPF_EMP_RATE);
        const totalEmpContrib = epsContrib + epfContrib;
        return {
            emp, slip,
            pfBasic, empContrib, epsContrib, epfContrib, totalEmpContrib,
            totalContrib: empContrib + totalEmpContrib,
            uan: (emp as any)?.uan || '',
        };
    }), [monthSlips, empMap]);

    // ESI details
    const esiRows = useMemo(() => monthSlips
        .filter(slip => (slip.grossSalary || 0) <= ESI_CEILING)
        .map(slip => {
            const emp = empMap[slip.employeeId];
            const gross = slip.grossSalary || 0;
            const empContrib = Math.round(gross * ESI_EMP_RATE);
            const erpContrib = Math.round(gross * ESI_EMP_RATE_EMPLOYER);
            return { emp, slip, gross, empContrib, erpContrib, total: empContrib + erpContrib };
        }), [monthSlips, empMap]);

    // PT details
    const ptRows = useMemo(() => monthSlips.map(slip => {
        const emp = empMap[slip.employeeId];
        const pt = getPT(slip.grossSalary || 0);
        return { emp, slip, pt };
    }), [monthSlips, empMap]);

    // ── Stats ────────────────────────────────────────────────────────────────
    const stats = useMemo(() => ({
        PF: {
            employees: pfRows.length,
            empContrib: pfRows.reduce((a, r) => a + r.empContrib, 0),
            erpContrib: pfRows.reduce((a, r) => a + r.totalEmpContrib, 0),
            total: pfRows.reduce((a, r) => a + r.totalContrib, 0),
        },
        ESI: {
            employees: esiRows.length,
            empContrib: esiRows.reduce((a, r) => a + r.empContrib, 0),
            erpContrib: esiRows.reduce((a, r) => a + r.erpContrib, 0),
            total: esiRows.reduce((a, r) => a + r.total, 0),
        },
        PT: {
            employees: ptRows.filter(r => r.pt > 0).length,
            total: ptRows.reduce((a, r) => a + r.pt, 0),
            empContrib: ptRows.reduce((a, r) => a + r.pt, 0),
            erpContrib: 0,
        },
    }), [pfRows, esiRows, ptRows]);

    // ── CSV Export Functions ──────────────────────────────────────────────────
    const exportPFECR = () => {
        const header = ['UAN', 'Member Name', 'Basic Wage (₹)', 'Employee PF (12%)', 'Employer EPS (8.33%)', 'Employer EPF (3.67%)', 'Total'];
        const rows = pfRows.map(r => [
            r.uan || 'N/A',
            r.emp?.name || r.slip.employeeId,
            r.pfBasic, r.empContrib, r.epsContrib, r.epfContrib, r.totalContrib,
        ]);
        downloadCSV(`PF_ECR_${selectedMonth}.csv`, [header, ...rows.map(r => r.map(String))]);
    };

    const exportPFChallan = () => {
        const s = stats.PF;
        const rows = [
            ['PF Challan', selectedMonth],
            ['Company', company?.name || ''],
            [''],
            ['Description', 'Amount (₹)'],
            ['Employee PF Contribution (12%)', String(s.empContrib)],
            ['Employer EPS Contribution (8.33%)', String(pfRows.reduce((a, r) => a + r.epsContrib, 0))],
            ['Employer EPF Contribution (3.67%)', String(pfRows.reduce((a, r) => a + r.epfContrib, 0))],
            ['Total PF Payable', String(s.total)],
            [''],
            ['No. of Employees', String(s.employees)],
            ['Due Date', '15th of next month'],
        ];
        downloadCSV(`PF_Challan_${selectedMonth}.csv`, rows);
    };

    const exportESIReturn = () => {
        const header = ['IP Number', 'Employee Name', 'Gross Wages (₹)', 'Employee ESI (0.75%)', 'Employer ESI (3.25%)', 'Total'];
        const rows = esiRows.map(r => [
            (r.emp as any)?.esiNumber || 'N/A',
            r.emp?.name || r.slip.employeeId,
            r.gross, r.empContrib, r.erpContrib, r.total,
        ]);
        downloadCSV(`ESI_Return_${selectedMonth}.csv`, [header, ...rows.map(r => r.map(String))]);
    };

    const exportESIChallan = () => {
        const s = stats.ESI;
        const rows = [
            ['ESI Challan', selectedMonth],
            ['Company', company?.name || ''],
            [''],
            ['Description', 'Amount (₹)'],
            ['Employee ESI (0.75%)', String(s.empContrib)],
            ['Employer ESI (3.25%)', String(s.erpContrib)],
            ['Total ESI Payable', String(s.total)],
            [''],
            ['Covered Employees', String(s.employees)],
            ['Due Date', '21st of next month'],
        ];
        downloadCSV(`ESI_Challan_${selectedMonth}.csv`, rows);
    };

    const exportPTReturn = () => {
        const header = ['Employee Code', 'Employee Name', 'Gross Salary (₹)', 'PT Deducted (₹)'];
        const rows = ptRows.filter(r => r.pt > 0).map(r => [
            r.emp?.code || '', r.emp?.name || r.slip.employeeId,
            r.slip.grossSalary || 0, r.pt,
        ]);
        const total = [['', 'TOTAL', ptRows.reduce((a, r) => a + (r.slip.grossSalary || 0), 0), stats.PT.total]];
        downloadCSV(`PT_Return_${selectedMonth}.csv`, [header, ...rows.map(r => r.map(String)), ...total.map(r => r.map(String))]);
    };

    const hasData = monthSlips.length > 0;
    const stat = stats[reportType];

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Building className="w-8 h-8 text-primary-500" />
                    Statutory Compliance Reports
                </h1>
                <p className="text-dark-muted mt-1">PF, ESI, and Professional Tax — live data from payroll</p>
            </div>

            {/* Controls */}
            <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-4">
                <Calendar className="w-5 h-5 text-primary-400 shrink-0" />
                <label className="text-white font-medium">Month:</label>
                <input type="month" value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="bg-dark-surface border border-dark-border rounded-lg px-4 py-2 text-white" />

                <div className={`ml-auto flex items-center gap-2 text-sm ${hasData ? 'text-green-400' : 'text-yellow-400'}`}>
                    {hasData ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {hasData ? `${monthSlips.length} payroll records found` : 'No payroll data for this month'}
                </div>
            </div>

            {/* Report Type Tabs */}
            <div className="flex gap-3">
                {(['PF', 'ESI', 'PT'] as const).map(type => (
                    <button key={type} onClick={() => setReportType(type)}
                        className={`flex-1 p-4 rounded-xl transition-all ${reportType === type
                            ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                            : 'glass text-dark-muted hover:bg-white/5'}`}>
                        <div className="text-2xl font-bold mb-1">{type}</div>
                        <div className="text-xs opacity-75">
                            {type === 'PF' ? 'Provident Fund' : type === 'ESI' ? 'Employee State Insurance' : 'Professional Tax'}
                        </div>
                    </button>
                ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass p-5 rounded-2xl">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-blue-500/20 rounded-xl"><Users className="w-5 h-5 text-blue-400" /></div>
                        <span className="text-dark-muted text-sm">Covered Employees</span>
                    </div>
                    <div className="text-3xl font-bold text-white">{stat.employees}</div>
                    <div className="text-xs text-slate-600 mt-1">{selectedMonth}</div>
                </div>

                <div className="glass p-5 rounded-2xl">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-green-500/20 rounded-xl"><Shield className="w-5 h-5 text-green-400" /></div>
                        <span className="text-dark-muted text-sm">Employee Contribution</span>
                    </div>
                    <div className="text-3xl font-bold text-white">{fmt(stat.empContrib)}</div>
                    <div className="text-xs text-slate-600 mt-1">
                        {reportType === 'PF' ? '@ 12% of basic (≤₹15,000)' :
                            reportType === 'ESI' ? '@ 0.75% of gross (≤₹21,000)' :
                                'Per slab (Maharashtra)'}
                    </div>
                </div>

                <div className="glass p-5 rounded-2xl">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-purple-500/20 rounded-xl"><TrendingUp className="w-5 h-5 text-purple-400" /></div>
                        <span className="text-dark-muted text-sm">{reportType !== 'PT' ? 'Employer Contribution' : 'Total PT Payable'}</span>
                    </div>
                    <div className="text-3xl font-bold text-white">{fmt(reportType !== 'PT' ? stat.erpContrib : stat.total)}</div>
                    <div className="text-xs text-slate-600 mt-1">
                        {reportType === 'PF' ? 'EPS (8.33%) + EPF (3.67%)' :
                            reportType === 'ESI' ? '@ 3.25% of gross' : ''}
                    </div>
                </div>
            </div>

            {/* Total payable highlight */}
            {reportType !== 'PT' && (
                <div className="glass rounded-2xl p-4 flex items-center justify-between">
                    <span className="text-white font-semibold">Total {reportType} Payable (Employee + Employer)</span>
                    <span className="text-2xl font-bold text-primary-400">{fmt(stat.total)}</span>
                </div>
            )}

            {/* Export Actions */}
            <div className="glass rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-primary-400" /> Export Files
                </h3>

                {!hasData && (
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-sm flex items-center gap-2 mb-4">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        Generate payroll for {selectedMonth} first, then export statutory files.
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reportType === 'PF' && (<>
                        <button onClick={exportPFECR} disabled={!hasData}
                            className="flex items-center justify-between p-4 bg-dark-surface hover:bg-white/5 disabled:opacity-40 rounded-xl transition-all border border-slate-800/50">
                            <div className="text-left">
                                <div className="text-white font-semibold">PF ECR File</div>
                                <div className="text-xs text-dark-muted mt-1">Electronic Challan cum Return (CSV)</div>
                            </div>
                            <Download className="w-5 h-5 text-primary-400 shrink-0" />
                        </button>
                        <button onClick={exportPFChallan} disabled={!hasData}
                            className="flex items-center justify-between p-4 bg-dark-surface hover:bg-white/5 disabled:opacity-40 rounded-xl transition-all border border-slate-800/50">
                            <div className="text-left">
                                <div className="text-white font-semibold">PF Challan Summary</div>
                                <div className="text-xs text-dark-muted mt-1">Payment challan CSV</div>
                            </div>
                            <Download className="w-5 h-5 text-primary-400 shrink-0" />
                        </button>
                    </>)}

                    {reportType === 'ESI' && (<>
                        <button onClick={exportESIReturn} disabled={!hasData}
                            className="flex items-center justify-between p-4 bg-dark-surface hover:bg-white/5 disabled:opacity-40 rounded-xl transition-all border border-slate-800/50">
                            <div className="text-left">
                                <div className="text-white font-semibold">ESI Monthly Return</div>
                                <div className="text-xs text-dark-muted mt-1">Per-employee ESI detail (CSV)</div>
                            </div>
                            <Download className="w-5 h-5 text-primary-400 shrink-0" />
                        </button>
                        <button onClick={exportESIChallan} disabled={!hasData}
                            className="flex items-center justify-between p-4 bg-dark-surface hover:bg-white/5 disabled:opacity-40 rounded-xl transition-all border border-slate-800/50">
                            <div className="text-left">
                                <div className="text-white font-semibold">ESI Challan Summary</div>
                                <div className="text-xs text-dark-muted mt-1">Payment challan CSV</div>
                            </div>
                            <Download className="w-5 h-5 text-primary-400 shrink-0" />
                        </button>
                    </>)}

                    {reportType === 'PT' && (<>
                        <button onClick={exportPTReturn} disabled={!hasData}
                            className="flex items-center justify-between p-4 bg-dark-surface hover:bg-white/5 disabled:opacity-40 rounded-xl transition-all border border-slate-800/50">
                            <div className="text-left">
                                <div className="text-white font-semibold">PT Monthly Return</div>
                                <div className="text-xs text-dark-muted mt-1">Per-employee PT deduction (CSV)</div>
                            </div>
                            <Download className="w-5 h-5 text-primary-400 shrink-0" />
                        </button>
                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300">
                            <p className="font-semibold mb-1">PT Slab (Maharashtra)</p>
                            <p>≤ ₹7,500/mo → Nil</p>
                            <p>₹7,501–₹10,000/mo → ₹175</p>
                            <p>Above ₹10,000/mo → ₹200 (₹300 in Feb)</p>
                        </div>
                    </>)}
                </div>

                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-xs text-yellow-300">
                    <span className="font-semibold">Note:</span> Ensure UAN (PF), IP Number (ESI) are updated in employee profiles for accurate ECR/return files. PF ceiling: ₹15,000 basic. ESI applicability: gross ≤ ₹21,000/month.
                </div>
            </div>
        </div>
    );
};
