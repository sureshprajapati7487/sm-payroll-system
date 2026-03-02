import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { usePayrollStore } from '@/store/payrollStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useProductionStore } from '@/store/productionStore';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';
import { ArrowLeft, Printer } from 'lucide-react';
import { sendPayslipWhatsApp } from '@/utils/whatsappService';
import { API_URL } from '@/lib/apiConfig';
import type { SalarySlip } from '@/types';

export const PayslipView = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { slips } = usePayrollStore();
    const { employees } = useEmployeeStore();
    const { companies, currentCompanyId } = useMultiCompanyStore();
    const currentCompany = companies.find(c => c.id === currentCompanyId);

    // 1. Try from store first (fast), then fallback to server fetch
    const [localSlip, setLocalSlip] = useState<SalarySlip | null>(
        slips.find(s => s.id === id) || null
    );
    const [isLoading, setIsLoading] = useState(!localSlip);
    const [notFound, setNotFound] = useState(false);

    // Fetch from server if not in store
    useEffect(() => {
        if (localSlip) return; // Already have it
        if (!id) { setNotFound(true); return; }
        setIsLoading(true);
        fetch(`${API_URL}/payroll/${id}`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then((data: SalarySlip) => setLocalSlip(data))
            .catch(() => setNotFound(true))
            .finally(() => setIsLoading(false));
    }, [id]);

    const slip = localSlip || slips.find(s => s.id === id);
    const employee = employees.find(e => e.id === slip?.employeeId);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-dark-bg flex items-center justify-center">
                <div className="text-center text-white">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary-400 mx-auto mb-4" />
                    <p className="text-dark-muted">Loading payslip...</p>
                </div>
            </div>
        );
    }

    if (notFound || !slip || !employee) {
        return (
            <div className="min-h-screen bg-dark-bg flex items-center justify-center">
                <div className="text-center text-white">
                    <p className="text-2xl font-bold mb-2">Payslip Not Found</p>
                    <p className="text-dark-muted mb-6">This slip does not exist or has not been generated yet.</p>
                    <button onClick={() => navigate('/payroll')} className="px-4 py-2 bg-primary-600 rounded-lg text-sm hover:bg-primary-500">
                        ← Back to Payroll
                    </button>
                </div>
            </div>
        );
    }

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-dark-bg p-4 md:p-8">
            {/* Action Bar - Hidden in Print */}
            <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-dark-muted hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>
                <div className="flex items-center gap-3">
                    {/* WhatsApp Send */}
                    <button
                        onClick={() => sendPayslipWhatsApp(employee, slip)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#1ebe59] text-white rounded-lg transition-colors font-medium shadow-lg shadow-green-600/20"
                        title="Send Payslip via WhatsApp"
                    >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        WhatsApp
                    </button>
                    {/* Print */}
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors font-medium"
                    >
                        <Printer className="w-4 h-4" />
                        Print / Save PDF
                    </button>
                </div>
            </div>

            {/* Payslip Paper */}
            <div className="max-w-4xl mx-auto bg-white text-black p-8 md:p-12 rounded-lg shadow-xl print:shadow-none print:w-full print:max-w-none print:p-6"
                style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>

                {/* Header — Company Info */}
                <div className="flex items-start justify-between border-b-2 border-gray-800 pb-6 mb-6">
                    {/* Left: Logo + Name */}
                    <div className="flex items-center gap-4">
                        {currentCompany?.logo ? (
                            <img src={currentCompany.logo} alt="Company Logo"
                                className="h-16 w-16 object-contain rounded" />
                        ) : (
                            <div className="h-16 w-16 rounded bg-gray-800 flex items-center justify-center text-white text-2xl font-black">
                                {(currentCompany?.code || 'SM').slice(0, 2).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900">
                                {currentCompany?.name || 'SM Payroll System'}
                            </h1>
                            {currentCompany?.address && (
                                <p className="text-gray-500 text-xs mt-0.5">{currentCompany.address}</p>
                            )}
                            <div className="flex gap-4 mt-1 text-xs text-gray-500">
                                {currentCompany?.gstNumber && <span>GST: {currentCompany.gstNumber}</span>}
                                {currentCompany?.panNumber && <span>PAN: {currentCompany.panNumber}</span>}
                            </div>
                        </div>
                    </div>
                    {/* Right: Slip Title */}
                    <div className="text-right">
                        <div className="inline-block bg-gray-800 text-white px-5 py-2 rounded-lg text-sm font-bold uppercase tracking-wider">
                            Salary Slip
                        </div>
                        <p className="text-gray-500 text-sm mt-2 font-medium">{slip.month}</p>
                        <p className="text-gray-400 text-xs">Generated: {new Date(slip.generatedOn).toLocaleDateString('en-IN')}</p>
                    </div>
                </div>

                {/* Employee Details — Professional 3-column grid */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Employee Information</h2>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                            <p className="text-gray-400 text-xs uppercase">Name</p>
                            <p className="font-bold text-gray-900">{employee.name}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs uppercase">Employee ID</p>
                            <p className="font-mono font-bold text-gray-900">{employee.code}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs uppercase">Designation</p>
                            <p className="font-semibold text-gray-900">{employee.designation || '—'}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs uppercase">Department</p>
                            <p className="font-semibold text-gray-900">{employee.department || '—'}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs uppercase">Joining Date</p>
                            <p className="font-semibold text-gray-900">{employee.joiningDate || '—'}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs uppercase">Days Worked</p>
                            <p className="font-bold text-gray-900">{slip.presentDays} <span className="text-gray-400 font-normal">/ {slip.totalDays} days</span></p>
                        </div>
                    </div>
                </div>

                {/* Bank Details Section */}
                <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-100">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">Bank & Payment Details</h2>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-gray-400 text-xs uppercase">Bank Name</p>
                            <p className="font-semibold text-gray-900">{employee.bankDetails?.bankName || '—'}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs uppercase">Account No.</p>
                            <p className="font-mono text-gray-900">{employee.bankDetails?.accountNumber || '—'}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs uppercase">IFSC Code</p>
                            <p className="font-mono text-gray-900">{employee.bankDetails?.ifscCode || '—'}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs uppercase">PAN</p>
                            <p className="font-mono text-gray-900">{employee.bankDetails?.panCard || '—'}</p>
                        </div>
                    </div>
                </div>

                {/* Salary Details Table */}
                <div className="border border-gray-300 mb-8">
                    <div className="grid grid-cols-2 bg-gray-100 border-b border-gray-300">
                        <div className="p-3 font-bold uppercase text-xs tracking-wider border-r border-gray-300">Earnings</div>
                        <div className="p-3 font-bold uppercase text-xs tracking-wider">Deductions</div>
                    </div>

                    <div className="grid grid-cols-2">
                        {/* Earnings Column */}
                        <div className="border-r border-gray-300">
                            <div className="p-3 flex justify-between border-b border-gray-100">
                                <span className="text-gray-600">Basic Salary</span>
                                <span className="font-mono">₹ {slip.basicSalary.toLocaleString()}</span>
                            </div>
                            <div className="p-3 flex justify-between border-b border-gray-100">
                                <span className="text-gray-600">Production Incentives</span>
                                <span className="font-mono">₹ {slip.productionAmount.toLocaleString()}</span>
                            </div>
                            <div className="p-3 flex justify-between border-b border-gray-100">
                                <span className="text-gray-600">Overtime</span>
                                <span className="font-mono">₹ {slip.overtimeAmount.toLocaleString()}</span>
                            </div>
                            <div className="p-3 flex justify-between border-b border-gray-100">
                                <span className="text-gray-600">Allowances</span>
                                <span className="font-mono">₹ {slip.allowances.toLocaleString()}</span>
                            </div>
                            <div className="p-3 flex justify-between bg-gray-50 font-bold">
                                <span>Gross Earnings</span>
                                <span>₹ {slip.grossSalary.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Deductions Column */}
                        <div>
                            <div className="p-3 flex justify-between border-b border-gray-100">
                                <span className="text-gray-600">Loan / EMI</span>
                                <span className="font-mono text-red-600">₹ {slip.loanDeduction.toLocaleString()}</span>
                            </div>
                            <div className="p-3 flex justify-between border-b border-gray-100">
                                <span className="text-gray-600">PF Contribution</span>
                                <span className="font-mono">₹ {slip.pfDeduction.toLocaleString()}</span>
                            </div>
                            <div className="p-3 flex justify-between border-b border-gray-100">
                                <span className="text-gray-600">Tax (TDS)</span>
                                <span className="font-mono">₹ {slip.taxDeduction.toLocaleString()}</span>
                            </div>
                            <div className="p-3 flex justify-between border-b border-gray-100">
                                <span className="text-gray-600">Other Deductions</span>
                                <span className="font-mono">₹ {slip.otherDeduction.toLocaleString()}</span>
                            </div>
                            <div className="p-3 flex justify-between bg-gray-50 font-bold">
                                <span>Total Deductions</span>
                                <span>₹ {slip.totalDeductions.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Net Salary */}
                {/* Production Incentive Breakdown (only when productionAmount > 0) */}
                {slip.productionAmount > 0 && (() => {
                    const { entries } = useProductionStore.getState();
                    const monthProds = entries.filter(
                        p => p.employeeId === employee.id &&
                            p.date.startsWith(slip.month) &&
                            p.status === 'APPROVED'
                    );
                    // Group by item
                    const itemMap = new Map<string, { qty: number; amount: number }>();
                    monthProds.forEach(p => {
                        const r = itemMap.get(p.item) || { qty: 0, amount: 0 };
                        itemMap.set(p.item, { qty: r.qty + p.qty, amount: r.amount + p.totalAmount });
                    });
                    const items = Array.from(itemMap.entries());
                    if (items.length === 0) return null;
                    return (
                        <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Production Incentive Breakdown</span>
                                <span className="text-xs text-gray-400">{slip.month}</span>
                            </div>
                            <table className="w-full text-xs text-left">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-4 py-2 font-bold text-gray-600">#</th>
                                        <th className="px-4 py-2 font-bold text-gray-600">Item / Work</th>
                                        <th className="px-4 py-2 font-bold text-gray-600 text-right">Qty</th>
                                        <th className="px-4 py-2 font-bold text-gray-600 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {items.map(([item, data], i) => (
                                        <tr key={item}>
                                            <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                                            <td className="px-4 py-2 font-medium text-gray-700">{item}</td>
                                            <td className="px-4 py-2 text-right font-mono text-gray-600">{data.qty.toLocaleString()}</td>
                                            <td className="px-4 py-2 text-right font-mono font-bold text-green-700">₹ {data.amount.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-50 border-t border-gray-300 font-bold">
                                        <td colSpan={3} className="px-4 py-2 text-gray-700">Total Production Incentive</td>
                                        <td className="px-4 py-2 text-right font-mono text-green-700">₹ {slip.productionAmount.toLocaleString()}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    );
                })()}

                {/* Net Pay Box */}
                <div className="flex items-center justify-between mb-10 mt-2">
                    <div className="text-sm text-gray-500">
                        <p>Absent Days: <span className="font-bold text-gray-800">{slip.absentDays ?? 0}</span></p>
                        {(slip.paidLeaveDays ?? 0) > 0 && <p>Paid Leave: <span className="font-bold text-gray-800">{slip.paidLeaveDays} days</span></p>}
                    </div>
                    <div className="bg-gray-800 text-white px-8 py-4 rounded-xl text-right"
                        style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', backgroundColor: '#1f2937' } as React.CSSProperties}>
                        <p className="text-xs uppercase text-gray-400 mb-1 tracking-widest">Net Pay</p>
                        <p className="text-3xl font-black">₹ {slip.netSalary.toLocaleString('en-IN')}</p>
                        <p className="text-xs text-gray-400 mt-1">Salary for {slip.month}</p>
                    </div>
                </div>


                {/* Signatures */}
                <div className="grid grid-cols-2 gap-12 mt-16 pt-6 border-t-2 border-gray-200">
                    <div className="text-center">
                        <div className="h-12 border-b border-gray-400 mb-2" />
                        <p className="font-bold text-gray-800">Employer Signature</p>
                        <p className="text-xs text-gray-500 mt-1">{currentCompany?.name || 'Authorized Signatory'}</p>
                    </div>
                    <div className="text-center">
                        <div className="h-12 border-b border-gray-400 mb-2" />
                        <p className="font-bold text-gray-800">Employee Signature</p>
                        <p className="text-xs text-gray-500 mt-1">{employee.name}</p>
                    </div>
                </div>

                {/* Detailed Work Log */}
                <div className="mt-10 mb-8" style={{ pageBreakBefore: 'auto' }}>
                    <h3 className="text-sm font-bold uppercase tracking-widest mb-3 border-b border-gray-300 pb-2 text-gray-600">Detailed Work Log — {slip.month}</h3>
                    <table className="w-full text-xs text-left">
                        <thead>
                            <tr className="bg-gray-100 border-b border-gray-300">
                                <th className="p-2 font-bold text-gray-700">Date</th>
                                <th className="p-2 font-bold text-gray-700">Status</th>
                                <th className="p-2 font-bold text-gray-700">In Time</th>
                                <th className="p-2 font-bold text-gray-700">Out Time</th>
                                <th className="p-2 font-bold text-gray-700 text-right">Production / OT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {(() => {
                                const { records } = useAttendanceStore.getState();
                                const { entries } = useProductionStore.getState();
                                const [year, month] = slip.month.split('-').map(Number);
                                const daysInMonth = new Date(year, month, 0).getDate();
                                const rows = [];

                                for (let d = 1; d <= daysInMonth; d++) {
                                    const dateStr = `${slip.month}-${String(d).padStart(2, '0')}`;
                                    const record = records.find(r => r.employeeId === employee.id && r.date === dateStr);
                                    const prodEntries = entries.filter(p => p.employeeId === employee.id && p.date === dateStr);
                                    if (!record && prodEntries.length === 0) continue;
                                    const productionTotal = prodEntries.reduce((sum, p) => sum + p.totalAmount, 0);

                                    rows.push(
                                        <tr key={dateStr} className="hover:bg-gray-50">
                                            <td className="p-2 font-mono text-gray-600">{dateStr}</td>
                                            <td className="p-2">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${record?.status === 'PRESENT' ? 'bg-green-100 text-green-700' :
                                                    record?.status === 'ABSENT' ? 'bg-red-100 text-red-700' :
                                                        record?.status === 'HALF_DAY' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-gray-100 text-gray-700'
                                                    }`}>{record?.status || '—'}</span>
                                            </td>
                                            <td className="p-2 font-mono text-gray-500">
                                                {record?.checkIn ? new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                            </td>
                                            <td className="p-2 font-mono text-gray-500">
                                                {record?.checkOut ? new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                            </td>
                                            <td className="p-2 text-right font-mono text-gray-700">
                                                {productionTotal > 0 ? `₹${productionTotal.toLocaleString('en-IN')}` : ''}
                                                {record?.overtimeHours ? ` +${record.overtimeHours}h OT` : ''}
                                                {!productionTotal && !record?.overtimeHours ? '—' : ''}
                                            </td>
                                        </tr>
                                    );
                                }
                                return rows.length > 0
                                    ? rows
                                    : <tr><td colSpan={5} className="p-4 text-center text-gray-400">No detailed records found.</td></tr>;
                            })()}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="mt-8 pt-4 border-t border-gray-100 text-center text-xs text-gray-400">
                    <p>This is a computer-generated document and does not require a physical signature.</p>
                    <p className="mt-1">{currentCompany?.name || 'SM Payroll System'} &nbsp;|&nbsp; Generated on {new Date(slip.generatedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>

            </div>
        </div>
    );
};
