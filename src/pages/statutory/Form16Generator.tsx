// Form16Generator — real data from payrollStore + HTML print-to-PDF
import { useState, useMemo } from 'react';
import { FileText, User, Calendar, Printer, CheckCircle, AlertCircle, Loader2, Building } from 'lucide-react';
import { useEmployeeStore } from '@/store/employeeStore';
import { usePayrollStore } from '@/store/payrollStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

// Indian Income Tax slabs (Old Regime, FY 2024-25)
function calcTax(income: number): number {
    if (income <= 250000) return 0;
    if (income <= 500000) return (income - 250000) * 0.05;
    if (income <= 1000000) return 12500 + (income - 500000) * 0.20;
    return 112500 + (income - 1000000) * 0.30;
}

export const Form16Generator = () => {
    const { employees } = useEmployeeStore();
    const { slips, isLoading, fetchPayroll } = usePayrollStore();
    const { companies, currentCompanyId } = useMultiCompanyStore();

    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [financialYear, setFinancialYear] = useState('2024-25');
    const [isPrinting, setIsPrinting] = useState(false);

    const company = companies.find(c => c.id === currentCompanyId);
    const emp = employees.find(e => e.id === selectedEmployee);

    // Compute annual summary from payroll slips for FY
    const annual = useMemo(() => {
        if (!selectedEmployee) return null;
        const [startY] = financialYear.split('-');
        const fyStart = `${startY}-04`;  // Apr of start year
        const fyEnd = `${Number(startY) + 1}-03`; // Mar of end year

        const empSlips = slips.filter(s =>
            s.employeeId === selectedEmployee &&
            s.month >= fyStart && s.month <= fyEnd
        );
        if (!empSlips.length) return null;

        const gross = empSlips.reduce((a, s) => a + (s.grossSalary || 0), 0);
        const netPay = empSlips.reduce((a, s) => a + (s.netSalary || 0), 0);
        const pf = empSlips.reduce((a, s) => a + (s.pfDeduction || 0), 0);
        const tds = empSlips.reduce((a, s) => a + (s.taxDeduction || 0), 0);
        const loans = empSlips.reduce((a, s) => a + (s.loanDeduction || 0), 0);
        const otherDed = empSlips.reduce((a, s) => a + (s.otherDeduction || 0), 0);
        const production = empSlips.reduce((a, s) => a + (s.productionAmount || 0), 0);
        const basic = empSlips.reduce((a, s) => a + (s.basicSalary || 0), 0);

        // Standard deduction (₹50,000 as per Sec 16) + PF (Sec 80C)
        const std80C = Math.min(pf, 150000);
        const taxableIncome = Math.max(0, gross - 50000 - std80C);
        const estimatedTax = calcTax(taxableIncome);
        const cess = estimatedTax * 0.04; // 4% Health & Education Cess

        return {
            months: empSlips.length, gross, netPay, pf, tds,
            loans, otherDed, production, basic,
            std80C, taxableIncome, estimatedTax, cess,
            totalTax: estimatedTax + cess,
        };
    }, [selectedEmployee, financialYear, slips]);

    // Generate printable HTML and open print dialog
    const handleGenerate = async () => {
        if (!emp || !annual) return;
        setIsPrinting(true);

        const [startY] = financialYear.split('-');
        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Form 16 — ${emp.name} — FY ${financialYear}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; }
    h1 { font-size: 15px; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    h2 { font-size: 12px; text-align: center; margin-bottom: 2px; }
    .center { text-align: center; }
    .badge { background: #1a56db; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; display: inline-block; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th, td { border: 1px solid #333; padding: 4px 8px; }
    th { background: #1e3a5f; color: white; }
    .section-head { background: #eaf0fb; font-weight: bold; font-size: 11px; }
    .total-row { background: #f0f0f0; font-weight: bold; }
    .sign-box { border: 1px solid #333; height: 60px; width: 200px; text-align: center; padding-top: 40px; font-size: 10px; color: #888; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .box { border: 1px solid #999; padding: 8px; border-radius: 4px; margin-bottom: 8px; }
    .box-title { font-weight: bold; font-size: 11px; border-bottom: 1px solid #ccc; margin-bottom: 6px; padding-bottom: 4px; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
  <div class="center">
    <div class="badge">FORM 16 — CERTIFICATE OF TAX DEDUCTED AT SOURCE FROM SALARY</div>
    <h1>[PART A] — TDS Certificate</h1>
    <p style="font-size:10px; margin-bottom:12px;">As per Section 203 of the Income-tax Act, 1961 | Financial Year: ${financialYear} (${startY}-04-01 to ${Number(startY) + 1}-03-31)</p>
  </div>

  <div class="two-col">
    <div class="box">
      <div class="box-title">Employer Details</div>
      <table style="border:none; margin:0;">
        <tr><td style="border:none; width:120px; color:#555;">Name</td><td style="border:none; font-weight:bold;">${company?.name || 'N/A'}</td></tr>
        <tr><td style="border:none; color:#555;">TAN</td><td style="border:none;">${(company as any)?.tan || 'MUMB12345G'}</td></tr>
        <tr><td style="border:none; color:#555;">PAN</td><td style="border:none;">${(company as any)?.taxId || 'AABCS1234A'}</td></tr>
        <tr><td style="border:none; color:#555;">Address</td><td style="border:none;">${company?.address || 'Mumbai, India'}</td></tr>
      </table>
    </div>
    <div class="box">
      <div class="box-title">Employee Details</div>
      <table style="border:none; margin:0;">
        <tr><td style="border:none; width:120px; color:#555;">Name</td><td style="border:none; font-weight:bold;">${emp.name}</td></tr>
        <tr><td style="border:none; color:#555;">Employee Code</td><td style="border:none;">${emp.code}</td></tr>
        <tr><td style="border:none; color:#555;">Designation</td><td style="border:none;">${emp.designation || 'N/A'}</td></tr>
        <tr><td style="border:none; color:#555;">Department</td><td style="border:none;">${emp.department || 'N/A'}</td></tr>
        <tr><td style="border:none; color:#555;">PAN</td><td style="border:none;">${(emp as any)?.pan || 'PENDING'}</td></tr>
      </table>
    </div>
  </div>

  <h1 style="margin:16px 0 8px;">[PART B] — Details of Salary & Tax Computation</h1>

  <table>
    <thead><tr><th style="text-align:left;">Particulars</th><th style="width:160px;">Amount (₹)</th></tr></thead>
    <tbody>
      <tr class="section-head"><td colspan="2">A. GROSS SALARY</td></tr>
      <tr><td style="padding-left:20px;">Basic Salary (Sec. 17(1))</td><td style="text-align:right;">${annual.basic.toLocaleString('en-IN')}</td></tr>
      <tr><td style="padding-left:20px;">Production / Variable Pay</td><td style="text-align:right;">${annual.production.toLocaleString('en-IN')}</td></tr>
      <tr class="total-row"><td>Gross Salary (A)</td><td style="text-align:right;">${annual.gross.toLocaleString('en-IN')}</td></tr>

      <tr class="section-head"><td colspan="2">B. DEDUCTIONS FROM GROSS SALARY (Sec. 16)</td></tr>
      <tr><td style="padding-left:20px;">Standard Deduction (Sec. 16(ia))</td><td style="text-align:right;">50,000</td></tr>
      <tr class="total-row"><td>Income Chargeable under Head 'Salaries' (A-B)</td><td style="text-align:right;">${(annual.gross - 50000).toLocaleString('en-IN')}</td></tr>

      <tr class="section-head"><td colspan="2">C. DEDUCTIONS UNDER CHAPTER VI-A</td></tr>
      <tr><td style="padding-left:20px;">Section 80C (PF Contribution)</td><td style="text-align:right;">${annual.std80C.toLocaleString('en-IN')}</td></tr>
      <tr class="total-row"><td>Total Deductions (C)</td><td style="text-align:right;">${annual.std80C.toLocaleString('en-IN')}</td></tr>

      <tr class="total-row" style="background:#dce8f5;"><td>Taxable Income (A - B - C)</td><td style="text-align:right; font-size:13px;">${annual.taxableIncome.toLocaleString('en-IN')}</td></tr>

      <tr class="section-head"><td colspan="2">D. TAX COMPUTATION (Old Regime)</td></tr>
      <tr><td style="padding-left:20px;">Income Tax on Total Income</td><td style="text-align:right;">${annual.estimatedTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td></tr>
      <tr><td style="padding-left:20px;">Health & Education Cess (4%)</td><td style="text-align:right;">${annual.cess.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td></tr>
      <tr class="total-row"><td>Total Tax Payable</td><td style="text-align:right;">${annual.totalTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td></tr>
      <tr><td>Tax Deducted at Source (TDS)</td><td style="text-align:right;">${annual.tds.toLocaleString('en-IN')}</td></tr>
      <tr class="total-row" style="background:#d4f0d4;"><td>Net Pay Released</td><td style="text-align:right;">${annual.netPay.toLocaleString('en-IN')}</td></tr>
    </tbody>
  </table>

  <div class="two-col" style="margin-top:24px;">
    <div>
      <p style="font-size:10px; color:#555; margin-bottom:4px;">Certified that the deductions stated above have been made/will be made and that the sum of ₹${annual.tds.toLocaleString('en-IN')} has been/will be deposited to the credit of the Central Government.</p>
    </div>
    <div style="text-align:right;">
      <div class="sign-box" style="float:right;">Authorised Signatory</div>
      <br style="clear:both;"/>
      <p style="font-size:10px; margin-top:4px;">Place: ${company?.address?.split(',')[0] || 'Mumbai'} | Date: ${new Date().toLocaleDateString('en-IN')}</p>
    </div>
  </div>

  <p style="font-size:9px; color:#888; text-align:center; margin-top:20px;">Generated by SM PAYROLL SYSTEM on ${new Date().toLocaleString('en-IN')} • This is a computer-generated document.</p>
</body>
</html>`;

        const win = window.open('', '_blank', 'width=900,height=700');
        if (win) {
            win.document.write(html);
            win.document.close();
            setTimeout(() => { win.print(); }, 600);
        }
        setIsPrinting(false);
    };

    // Need to load payroll if not yet fetched
    const handleEmployeeChange = async (empId: string) => {
        setSelectedEmployee(empId);
        if (empId) await fetchPayroll();
    };

    const activeEmployees = employees.filter(e => e.status === 'ACTIVE');

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <FileText className="w-8 h-8 text-primary-500" />
                    Form 16 Generator
                </h1>
                <p className="text-dark-muted mt-1">Annual TDS certificate — real payroll data, print-ready PDF</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left — Config */}
                <div className="glass rounded-2xl p-6 space-y-5">
                    <h3 className="text-lg font-semibold text-white">Generate Certificate</h3>

                    <div>
                        <label className="block text-sm font-medium text-white mb-2 flex items-center gap-2">
                            <User className="w-4 h-4" /> Select Employee
                        </label>
                        <select value={selectedEmployee} onChange={e => handleEmployeeChange(e.target.value)}
                            className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white">
                            <option value="">-- Choose Employee --</option>
                            {activeEmployees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name} ({emp.code})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-white mb-2 flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Financial Year
                        </label>
                        <select value={financialYear} onChange={e => setFinancialYear(e.target.value)}
                            className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white">
                            <option value="2024-25">2024-25</option>
                            <option value="2023-24">2023-24</option>
                            <option value="2022-23">2022-23</option>
                        </select>
                    </div>

                    {/* Status */}
                    {selectedEmployee && (
                        <div className={`p-3 rounded-xl text-sm flex items-center gap-2 ${isLoading ? 'bg-blue-500/10 text-blue-400' :
                            annual ? 'bg-green-500/10 border border-green-500/20 text-green-400' :
                                'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'}`}>
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> :
                                annual ? <CheckCircle className="w-4 h-4" /> :
                                    <AlertCircle className="w-4 h-4" />}
                            {isLoading ? 'Loading payroll data...' :
                                annual ? `${annual.months} months of data found for FY ${financialYear}` :
                                    `No payroll data found for FY ${financialYear}`}
                        </div>
                    )}

                    <button onClick={handleGenerate} disabled={!selectedEmployee || !annual || isPrinting}
                        className="w-full bg-gradient-to-r from-primary-600 to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 text-white px-6 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2">
                        {isPrinting ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</> :
                            <><Printer className="w-5 h-5" /> Generate & Print Form 16</>}
                    </button>

                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 space-y-1">
                        <p className="font-semibold">Form 16 includes:</p>
                        <p>✓ Part A: TDS Certificate (Employer + Employee details)</p>
                        <p>✓ Part B: Gross Salary, Standard Deduction (₹50,000)</p>
                        <p>✓ Chapter VI-A: 80C (PF), taxable income</p>
                        <p>✓ Tax computation (Old Regime) + 4% Cess</p>
                        <p>✓ Authorised signatory block</p>
                    </div>
                </div>

                {/* Right — Live Summary */}
                <div className="glass rounded-2xl p-6">
                    {!annual ? (
                        <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                            <FileText className="w-16 h-16 text-slate-600 mb-4" />
                            <p className="text-slate-500 text-sm">Select an employee to see their annual summary</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center font-bold text-primary-400">
                                    {emp?.name?.[0]}
                                </div>
                                <div>
                                    <p className="text-white font-semibold">{emp?.name}</p>
                                    <p className="text-xs text-slate-500">{emp?.designation} • FY {financialYear}</p>
                                </div>
                            </div>

                            {/* Summary table */}
                            <div className="space-y-2">
                                {[
                                    { label: 'Gross Salary', value: fmt(annual.gross), color: 'text-white' },
                                    { label: 'Standard Deduction (Sec 16)', value: fmt(50000), color: 'text-slate-400' },
                                    { label: 'PF (Sec 80C)', value: fmt(annual.std80C), color: 'text-slate-400' },
                                    { label: 'Taxable Income', value: fmt(annual.taxableIncome), color: 'text-yellow-400', bold: true },
                                    { label: 'Income Tax', value: fmt(Math.round(annual.estimatedTax)), color: 'text-orange-400' },
                                    { label: '+ Cess (4%)', value: fmt(Math.round(annual.cess)), color: 'text-orange-400' },
                                    { label: 'TDS Deducted', value: fmt(annual.tds), color: 'text-red-400' },
                                    { label: 'Net Pay Released', value: fmt(annual.netPay), color: 'text-green-400', bold: true },
                                ].map(row => (
                                    <div key={row.label} className="flex justify-between items-center text-sm py-1 border-b border-slate-800/50">
                                        <span className="text-slate-400">{row.label}</span>
                                        <span className={`${row.color} ${row.bold ? 'font-bold' : ''}`}>{row.value}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-2 flex items-center gap-2 text-xs text-slate-500">
                                <Building className="w-3.5 h-3.5" />
                                <span>{company?.name} • {annual.months} months</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
