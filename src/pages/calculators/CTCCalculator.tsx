import { useState } from 'react';
import { Calculator, Download, RefreshCw } from 'lucide-react';
import { CTCCalculator as CTCCalc } from '@/utils/ctcCalculator';

export const CTCCalculator = () => {
    const [basicSalary, setBasicSalary] = useState<number>(30000);
    const [state, setState] = useState('MAHARASHTRA');
    const [result, setResult] = useState<any>(null);

    const handleCalculate = () => {
        const ctc = CTCCalc.calculateCTC({
            basicSalary,
            state
        });
        setResult(ctc);
    };

    const handleReset = () => {
        setBasicSalary(30000);
        setState('MAHARASHTRA');
        setResult(null);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Calculator className="w-8 h-8 text-primary-500" />
                        CTC Calculator
                    </h1>
                    <p className="text-dark-muted mt-1">Calculate complete Cost to Company breakdown</p>
                </div>
                <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 bg-dark-surface hover:bg-white/5 text-white rounded-xl transition-all"
                >
                    <RefreshCw className="w-4 h-4" />
                    Reset
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Input Form */}
                <div className="glass rounded-2xl p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Input Details</h3>

                    <div>
                        <label className="block text-sm font-medium text-white mb-2">
                            Basic Salary (₹/month)
                        </label>
                        <input
                            type="number"
                            value={basicSalary}
                            onChange={(e) => setBasicSalary(Number(e.target.value))}
                            className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white"
                            placeholder="30000"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-white mb-2">
                            State (for Professional Tax)
                        </label>
                        <select
                            value={state}
                            onChange={(e) => setState(e.target.value)}
                            className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white"
                        >
                            <option value="MAHARASHTRA">Maharashtra</option>
                            <option value="KARNATAKA">Karnataka</option>
                            <option value="WEST_BENGAL">West Bengal</option>
                            <option value="TAMIL_NADU">Tamil Nadu</option>
                            <option value="GUJARAT">Gujarat</option>
                            <option value="ANDHRA_PRADESH">Andhra Pradesh</option>
                            <option value="TELANGANA">Telangana</option>
                            <option value="MADHYA_PRADESH">Madhya Pradesh</option>
                        </select>
                    </div>

                    <button
                        onClick={handleCalculate}
                        className="w-full bg-gradient-to-r from-primary-600 to-blue-600 hover:from-primary-500 hover:to-blue-500 text-white px-6 py-3 rounded-xl font-medium transition-all"
                    >
                        Calculate CTC
                    </button>
                </div>

                {/* Results */}
                {result && (
                    <>
                        {/* Summary Cards */}
                        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="glass rounded-2xl p-6">
                                <div className="text-dark-muted text-sm mb-2">Total CTC (Annual)</div>
                                <div className="text-3xl font-bold text-primary-400">
                                    {formatCurrency(result.totalCTC * 12)}
                                </div>
                                <div className="text-dark-muted text-xs mt-1">
                                    {formatCurrency(result.totalCTC)}/month
                                </div>
                            </div>

                            <div className="glass rounded-2xl p-6">
                                <div className="text-dark-muted text-sm mb-2">In-Hand Salary</div>
                                <div className="text-3xl font-bold text-success">
                                    {formatCurrency(result.netSalary)}
                                </div>
                                <div className="text-dark-muted text-xs mt-1">per month</div>
                            </div>

                            <div className="glass rounded-2xl p-6">
                                <div className="text-dark-muted text-sm mb-2">Gross Salary</div>
                                <div className="text-2xl font-bold text-white">
                                    {formatCurrency(result.grossSalary)}
                                </div>
                            </div>

                            <div className="glass rounded-2xl p-6">
                                <div className="text-dark-muted text-sm mb-2">Total Deductions</div>
                                <div className="text-2xl font-bold text-danger">
                                    {formatCurrency(result.totalDeductions)}
                                </div>
                            </div>
                        </div>

                        {/* Detailed Breakdown */}
                        <div className="lg:col-span-3 glass rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white">Detailed Breakdown</h3>
                                <button className="flex items-center gap-2 px-3 py-1.5 bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 rounded-lg text-sm transition-all">
                                    <Download className="w-4 h-4" />
                                    Export PDF
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Earnings */}
                                <div>
                                    <h4 className="text-sm font-semibold text-success mb-3">Earnings</h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-dark-muted">Basic Salary</span>
                                            <span className="text-white font-medium">{formatCurrency(result.basicSalary)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-dark-muted">HRA</span>
                                            <span className="text-white font-medium">{formatCurrency(result.hra)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-dark-muted">Special Allowance</span>
                                            <span className="text-white font-medium">{formatCurrency(result.specialAllowance)}</span>
                                        </div>
                                        <div className="border-t border-dark-border pt-2 flex justify-between text-sm font-semibold">
                                            <span className="text-white">Gross Salary</span>
                                            <span className="text-success">{formatCurrency(result.grossSalary)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Deductions */}
                                <div>
                                    <h4 className="text-sm font-semibold text-danger mb-3">Deductions</h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-dark-muted">PF (Employee)</span>
                                            <span className="text-white font-medium">{formatCurrency(result.employeePF)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-dark-muted">ESI (Employee)</span>
                                            <span className="text-white font-medium">{formatCurrency(result.employeeESI)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-dark-muted">Professional Tax</span>
                                            <span className="text-white font-medium">{formatCurrency(result.professionalTax)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-dark-muted">TDS</span>
                                            <span className="text-white font-medium">{formatCurrency(result.tds)}</span>
                                        </div>
                                        <div className="border-t border-dark-border pt-2 flex justify-between text-sm font-semibold">
                                            <span className="text-white">Total Deductions</span>
                                            <span className="text-danger">{formatCurrency(result.totalDeductions)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Employer Cost */}
                                <div>
                                    <h4 className="text-sm font-semibold text-primary-400 mb-3">Employer Cost</h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-dark-muted">PF (Employer)</span>
                                            <span className="text-white font-medium">{formatCurrency(result.employerPF)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-dark-muted">ESI (Employer)</span>
                                            <span className="text-white font-medium">{formatCurrency(result.employerESI)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-dark-muted">Gratuity</span>
                                            <span className="text-white font-medium">{formatCurrency(result.gratuity)}</span>
                                        </div>
                                        <div className="border-t border-dark-border pt-2 flex justify-between text-sm font-semibold">
                                            <span className="text-white">Total CTC</span>
                                            <span className="text-primary-400">{formatCurrency(result.totalCTC)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {!result && (
                    <div className="lg:col-span-2 glass rounded-2xl p-12 text-center">
                        <Calculator className="w-16 h-16 text-dark-muted mx-auto mb-4" />
                        <p className="text-dark-muted">
                            Enter salary details and click Calculate to see CTC breakdown
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
