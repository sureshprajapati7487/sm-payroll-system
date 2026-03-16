import { useState } from 'react';
import { Shield, AlertTriangle, Loader2 } from 'lucide-react';
import { useMultiCompanyStore } from '@/store/multiCompanyStore';

export const PFESICalculator = () => {
    const currentCompanyId = useMultiCompanyStore(s => s.currentCompanyId);
    const [basicSalary, setBasicSalary] = useState<number>(15000);
    const [grossSalary, setGrossSalary] = useState<number>(25000);
    const [pfResult, setPfResult] = useState<any>(null);
    const [esiResult, setEsiResult] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCalculate = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch('/api/calculators/pf-esi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({
                    companyId: currentCompanyId,
                    basicSalary,
                    grossSalary,
                    date: new Date().toISOString()
                })
            });

            if (!response.ok) throw new Error('Failed to compute calculation');
            const data = await response.json();

            setPfResult(data.pf);
            setEsiResult(data.esi);
        } catch (err: any) {
            setError(err.message || 'Verification Error');
        } finally {
            setIsLoading(false);
        }
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
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Shield className="w-8 h-8 text-primary-500" />
                    PF & ESI Calculator
                </h1>
                <p className="text-dark-muted mt-1">Calculate Provident Fund and Employee State Insurance contributions</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Input Form */}
                <div className="glass rounded-2xl p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Salary Details</h3>

                    <div>
                        <label className="block text-sm font-medium text-white mb-2">
                            Basic Salary (₹/month)
                        </label>
                        <input
                            type="number"
                            value={basicSalary}
                            onChange={(e) => setBasicSalary(Number(e.target.value))}
                            className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white"
                            placeholder="15000"
                        />
                        <p className="text-xs text-dark-muted mt-1">For PF calculation</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-white mb-2">
                            Gross Salary (₹/month)
                        </label>
                        <input
                            type="number"
                            value={grossSalary}
                            onChange={(e) => setGrossSalary(Number(e.target.value))}
                            className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white"
                            placeholder="25000"
                        />
                        <p className="text-xs text-dark-muted mt-1">For ESI calculation</p>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-sm text-red-400">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleCalculate}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-blue-600 hover:from-primary-500 hover:to-blue-500 text-white px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Calculating...</>
                        ) : (
                            'Calculate PF & ESI'
                        )}
                    </button>

                    {/* Info Cards */}
                    <div className="mt-6 space-y-2">
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                            <div className="text-xs text-blue-400 font-semibold mb-1">PF Threshold</div>
                            <div className="text-xs text-dark-muted">
                                Applicable if Basic ≤ ₹15,000
                            </div>
                        </div>
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                            <div className="text-xs text-green-400 font-semibold mb-1">ESI Threshold</div>
                            <div className="text-xs text-dark-muted">
                                Applicable if Gross ≤ ₹21,000
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results */}
                {pfResult && esiResult ? (
                    <>
                        {/* PF Card */}
                        <div className="glass rounded-2xl p-6">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                <h3 className="text-lg font-semibold text-white">Provident Fund (PF)</h3>
                                {pfResult.isApplicable ? (
                                    <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
                                        Applicable
                                    </span>
                                ) : (
                                    <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full">
                                        Not Applicable
                                    </span>
                                )}
                            </div>

                            {pfResult.isApplicable ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-4 bg-blue-500/10 rounded-xl">
                                        <div>
                                            <div className="text-dark-muted text-sm">Employee Contribution</div>
                                            <div className="text-xs text-dark-muted mt-1">12% of Basic</div>
                                        </div>
                                        <div className="text-2xl font-bold text-blue-400">
                                            {formatCurrency(pfResult.employeeContribution)}
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center p-4 bg-purple-500/10 rounded-xl">
                                        <div>
                                            <div className="text-dark-muted text-sm">Employer Contribution</div>
                                            <div className="text-xs text-dark-muted mt-1">12% of Basic</div>
                                        </div>
                                        <div className="text-2xl font-bold text-purple-400">
                                            {formatCurrency(pfResult.employerContribution)}
                                        </div>
                                    </div>

                                    <div className="border-t border-dark-border pt-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-white font-semibold">Total PF</span>
                                            <span className="text-3xl font-bold text-primary-400">
                                                {formatCurrency(pfResult.totalPF)}
                                            </span>
                                        </div>
                                        <div className="text-xs text-dark-muted mt-1 text-right">per month</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8">
                                    <AlertTriangle className="w-12 h-12 text-red-400 mb-3" />
                                    <p className="text-dark-muted text-center text-sm">
                                        {pfResult.reason || 'PF not applicable for this salary'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* ESI Card */}
                        <div className="glass rounded-2xl p-6">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                <h3 className="text-lg font-semibold text-white">Employee State Insurance (ESI)</h3>
                                {esiResult.isApplicable ? (
                                    <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
                                        Applicable
                                    </span>
                                ) : (
                                    <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full">
                                        Not Applicable
                                    </span>
                                )}
                            </div>

                            {esiResult.isApplicable ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-4 bg-green-500/10 rounded-xl">
                                        <div>
                                            <div className="text-dark-muted text-sm">Employee Contribution</div>
                                            <div className="text-xs text-dark-muted mt-1">0.75% of Gross</div>
                                        </div>
                                        <div className="text-2xl font-bold text-green-400">
                                            {formatCurrency(esiResult.employeeContribution)}
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center p-4 bg-teal-500/10 rounded-xl">
                                        <div>
                                            <div className="text-dark-muted text-sm">Employer Contribution</div>
                                            <div className="text-xs text-dark-muted mt-1">3.25% of Gross</div>
                                        </div>
                                        <div className="text-2xl font-bold text-teal-400">
                                            {formatCurrency(esiResult.employerContribution)}
                                        </div>
                                    </div>

                                    <div className="border-t border-dark-border pt-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-white font-semibold">Total ESI</span>
                                            <span className="text-3xl font-bold text-success">
                                                {formatCurrency(esiResult.totalESI)}
                                            </span>
                                        </div>
                                        <div className="text-xs text-dark-muted mt-1 text-right">per month</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8">
                                    <AlertTriangle className="w-12 h-12 text-red-400 mb-3" />
                                    <p className="text-dark-muted text-center text-sm">
                                        {esiResult.reason || 'ESI not applicable for this salary'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="lg:col-span-2 glass rounded-2xl p-12 text-center">
                        <Shield className="w-16 h-16 text-dark-muted mx-auto mb-4" />
                        <p className="text-dark-muted">
                            Enter salary details to calculate PF & ESI
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
