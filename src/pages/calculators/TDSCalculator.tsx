import { useState, useMemo } from 'react';
import { TrendingUp, Download, AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useSystemKeyStore } from '@/store/systemKeyStore';
import { TDSCalculator as TDSCalc } from '@/utils/tdsCalculator';

export const TDSCalculator = () => {
    const { keys } = useSystemKeyStore();
    const [annualSalary, setAnnualSalary] = useState<number>(600000);
    const [section80C, setSection80C] = useState<number>(150000);
    const [section80D, setSection80D] = useState<number>(25000);
    const [result, setResult] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const customSlabs = useMemo(() => {
        const slabKey = keys.find(k => k.key === 'PAYROLL_TAX_SLABS');
        if (slabKey && slabKey.value) {
            try { return JSON.parse(slabKey.value); } catch (e) { }
        }
        return undefined;
    }, [keys]);

    const handleCalculate = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch('/api/calculators/tds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ annualSalary, section80C, section80D, customSlabs })
            });

            if (!response.ok) throw new Error('Calculation Engine Error');
            const data = await response.json();
            setResult(data);
        } catch (err: any) {
            setError(err.message || 'Failed to connect to Calculation Engine');
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
                    <TrendingUp className="w-8 h-8 text-primary-500" />
                    TDS Calculator (FY 2024-25)
                </h1>
                <p className="text-dark-muted mt-1">Calculate income tax and compare Old vs New regime</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Input Form */}
                <div className="glass rounded-2xl p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Income & Deductions</h3>

                    <div>
                        <label className="block text-sm font-medium text-white mb-2">
                            Annual Gross Salary (₹)
                        </label>
                        <input
                            type="number"
                            value={annualSalary}
                            onChange={(e) => setAnnualSalary(Number(e.target.value))}
                            className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white"
                            placeholder="600000"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-white mb-2">
                            Section 80C (Max ₹1.5L)
                        </label>
                        <input
                            type="number"
                            value={section80C}
                            onChange={(e) => setSection80C(Math.min(Number(e.target.value), 150000))}
                            max={150000}
                            className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white"
                            placeholder="150000"
                        />
                        <p className="text-xs text-dark-muted mt-1">PPF, ELSS, Life Insurance, etc.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-white mb-2">
                            Section 80D (Max ₹25K)
                        </label>
                        <input
                            type="number"
                            value={section80D}
                            onChange={(e) => setSection80D(Math.min(Number(e.target.value), 25000))}
                            max={25000}
                            className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white"
                            placeholder="25000"
                        />
                        <p className="text-xs text-dark-muted mt-1">Health Insurance Premium</p>
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
                            'Calculate TDS'
                        )}
                    </button>
                </div>

                {/* Results */}
                {result && (
                    <>
                        {/* Regime Comparison */}
                        <div className="lg:col-span-2 space-y-4">
                            {/* Recommendation Badge */}
                            <div className={`glass rounded-2xl p-4 border-2 ${result.recommendedRegime === 'NEW'
                                ? 'border-primary-500 bg-primary-500/10'
                                : 'border-yellow-500 bg-yellow-500/10'
                                }`}>
                                <div className="flex items-center gap-3">
                                    <AlertCircle className={`w-6 h-6 ${result.recommendedRegime === 'NEW' ? 'text-primary-400' : 'text-yellow-400'
                                        }`} />
                                    <div>
                                        <div className="text-white font-semibold">
                                            {result.recommendedRegime === 'NEW' ? 'New Regime' : 'Old Regime'} is better for you!
                                        </div>
                                        <div className="text-sm text-dark-muted">
                                            Saves ₹{Math.abs(result.newRegimeTax - result.oldRegimeTax).toLocaleString('en-IN')} in taxes
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Comparison Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Old Regime */}
                                <div className={`glass rounded-2xl p-6 ${result.recommendedRegime === 'OLD' ? 'border-2 border-yellow-500' : ''
                                    }`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-lg font-semibold text-white">Old Regime</h4>
                                        {result.recommendedRegime === 'OLD' && (
                                            <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full">
                                                Recommended
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-dark-muted">Gross Income</span>
                                            <span className="text-white">{formatCurrency(result.grossIncome)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-dark-muted">Standard Deduction</span>
                                            <span className="text-green-400">-{formatCurrency(result.standardDeduction)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-dark-muted">80C Deduction</span>
                                            <span className="text-green-400">-{formatCurrency(result.section80C)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-dark-muted">80D Deduction</span>
                                            <span className="text-green-400">-{formatCurrency(result.section80D)}</span>
                                        </div>
                                        <div className="border-t border-dark-border pt-3">
                                            <div className="flex justify-between">
                                                <span className="text-white font-semibold">Total Tax</span>
                                                <span className="text-2xl font-bold text-yellow-400">
                                                    {formatCurrency(result.oldRegimeTax)}
                                                </span>
                                            </div>
                                            {TDSCalc.getTaxBreakdown(result.taxableIncome, 'OLD', customSlabs).map((breakdown: any, i: number) => (
                                                <div key={i} className="text-xs text-dark-muted mt-1">
                                                    {breakdown.min ? breakdown.min.toLocaleString('en-IN') : breakdown.slab} : {formatCurrency(breakdown.tax)}
                                                </div>
                                            ))}
                                            <div className="text-xs text-dark-muted mt-1">
                                                Monthly: {formatCurrency(result.oldRegimeTax / 12)}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* New Regime */}
                                <div className={`glass rounded-2xl p-6 ${result.recommendedRegime === 'NEW' ? 'border-2 border-primary-500' : ''
                                    }`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-lg font-semibold text-white">New Regime</h4>
                                        {result.recommendedRegime === 'NEW' && (
                                            <span className="text-xs px-2 py-1 bg-primary-500/20 text-primary-400 rounded-full">
                                                Recommended
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-dark-muted">Gross Income</span>
                                            <span className="text-white">{formatCurrency(result.grossIncome)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-dark-muted">Deductions</span>
                                            <span className="text-dark-muted">Not Allowed</span>
                                        </div>
                                        <div className="h-12"></div>
                                        <div className="border-t border-dark-border pt-3">
                                            <div className="flex justify-between">
                                                <span className="text-white font-semibold">Total Tax</span>
                                                <span className="text-2xl font-bold text-primary-400">
                                                    {formatCurrency(result.newRegimeTax)}
                                                </span>
                                            </div>
                                            {TDSCalc.getTaxBreakdown(result.taxableIncome, 'NEW', customSlabs).map((breakdown: any, i: number) => (
                                                <div key={i} className="text-xs text-dark-muted mt-1">
                                                    {breakdown.min ? breakdown.min.toLocaleString('en-IN') : breakdown.slab} : {formatCurrency(breakdown.tax)}
                                                </div>
                                            ))}
                                            <div className="text-xs text-dark-muted mt-1">
                                                Monthly: {formatCurrency(result.newRegimeTax / 12)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Monthly TDS */}
                            <div className="glass rounded-2xl p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-dark-muted text-sm mb-1">Monthly TDS (Recommended Regime)</div>
                                        <div className="text-3xl font-bold text-white">
                                            {formatCurrency(result.monthlyTDS)}
                                        </div>
                                    </div>
                                    <button className="flex items-center gap-2 px-4 py-2 bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 rounded-lg transition-all">
                                        <Download className="w-4 h-4" />
                                        Export
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {!result && (
                    <div className="lg:col-span-2 glass rounded-2xl p-12 text-center">
                        <TrendingUp className="w-16 h-16 text-dark-muted mx-auto mb-4" />
                        <p className="text-dark-muted">
                            Enter your income details to calculate TDS
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
