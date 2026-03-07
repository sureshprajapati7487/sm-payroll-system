import { useState } from 'react';
import { Play, Calculator, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { useEmployeeStore } from '@/store/employeeStore';

interface SimulationResult {
    employeeId: string;
    employeeName: string;
    currentSalary: number;
    simulatedSalary: number;
    difference: number;
    percentChange: number;
}

export const PayrollSimulation = () => {
    const [running, setRunning] = useState(false);
    const [scenario, setScenario] = useState<'raise' | 'bonus' | 'deduction'>('raise');
    const [percentage, setPercentage] = useState(10);
    const [results, setResults] = useState<SimulationResult[]>([]);

    const { employees } = useEmployeeStore();

    // Use actual active employees with a defined basic salary
    const activeEmployees = employees.filter(e => e.status === 'ACTIVE' && e.basicSalary > 0);

    const runSimulation = () => {
        setRunning(true);

        setTimeout(() => {
            const simulationResults: SimulationResult[] = activeEmployees.map(emp => {
                let newSalary = emp.basicSalary;

                if (scenario === 'raise') {
                    newSalary = emp.basicSalary * (1 + percentage / 100);
                } else if (scenario === 'bonus') {
                    newSalary = emp.basicSalary + (emp.basicSalary * percentage / 100);
                } else if (scenario === 'deduction') {
                    newSalary = emp.basicSalary * (1 - percentage / 100);
                }

                return {
                    employeeId: emp.id,
                    employeeName: emp.name,
                    currentSalary: emp.basicSalary,
                    simulatedSalary: Math.round(newSalary),
                    difference: Math.round(newSalary - emp.basicSalary),
                    percentChange: percentage
                };
            });

            setResults(simulationResults);
            setRunning(false);
        }, 1500);
    };

    const totalCurrent = results.reduce((sum, r) => sum + r.currentSalary, 0);
    const totalSimulated = results.reduce((sum, r) => sum + r.simulatedSalary, 0);
    const totalDifference = totalSimulated - totalCurrent;

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Calculator className="w-8 h-8 text-primary-500" />
                    Payroll Simulation
                </h1>
                <p className="text-dark-muted mt-1">Test "what-if" scenarios before finalizing payroll</p>
            </div>

            {/* Simulation Controls */}
            <div className="glass rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Configure Scenario</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="text-white font-medium mb-2 block">Scenario Type</label>
                        <select
                            value={scenario}
                            onChange={(e) => setScenario(e.target.value as any)}
                            className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white"
                        >
                            <option value="raise">Salary Raise</option>
                            <option value="bonus">One-time Bonus</option>
                            <option value="deduction">Temporary Deduction</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-white font-medium mb-2 block">Percentage</label>
                        <input
                            type="number"
                            value={percentage}
                            onChange={(e) => setPercentage(parseFloat(e.target.value))}
                            className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white"
                            min="0"
                            max="100"
                        />
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={runSimulation}
                            disabled={running}
                            className="w-full bg-gradient-to-r from-primary-600 to-blue-600 hover:from-primary-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            {running ? (
                                <>
                                    <Play className="w-5 h-5 animate-spin" />
                                    Simulating...
                                </>
                            ) : (
                                <>
                                    <Play className="w-5 h-5" />
                                    Run Simulation
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <div className="text-blue-400 font-semibold text-sm mb-1">Dry Run Mode</div>
                    <div className="text-dark-muted text-xs">
                        This is a simulation only. No changes will be made to actual payroll data.
                    </div>
                </div>
            </div>

            {/* Results Summary */}
            {results.length > 0 && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass rounded-2xl p-6">
                            <div className="text-dark-muted text-sm">Current Total</div>
                            <div className="text-3xl font-bold text-white mt-1">
                                ₹{totalCurrent.toLocaleString()}
                            </div>
                        </div>

                        <div className="glass rounded-2xl p-6">
                            <div className="text-dark-muted text-sm">Simulated Total</div>
                            <div className="text-3xl font-bold text-primary-400 mt-1">
                                ₹{totalSimulated.toLocaleString()}
                            </div>
                        </div>

                        <div className="glass rounded-2xl p-6">
                            <div className="text-dark-muted text-sm">Impact</div>
                            <div className={`text-3xl font-bold mt-1 ${totalDifference >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {totalDifference >= 0 ? '+' : ''}₹{totalDifference.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* Detailed Results */}
                    <div className="glass rounded-2xl overflow-hidden">
                        <div className="p-6 border-b border-dark-border">
                            <h3 className="text-lg font-semibold text-white">Simulation Results</h3>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-dark-surface">
                                    <tr>
                                        <th className="text-left p-4 text-dark-muted font-medium">Employee</th>
                                        <th className="text-right p-4 text-dark-muted font-medium">Current</th>
                                        <th className="text-right p-4 text-dark-muted font-medium">Simulated</th>
                                        <th className="text-right p-4 text-dark-muted font-medium">Difference</th>
                                        <th className="text-right p-4 text-dark-muted font-medium">Impact</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border">
                                    {results.map((result) => (
                                        <tr key={result.employeeId} className="hover:bg-white/5 transition-all">
                                            <td className="p-4 text-white font-semibold">{result.employeeName}</td>
                                            <td className="p-4 text-right text-white">₹{result.currentSalary.toLocaleString()}</td>
                                            <td className="p-4 text-right text-primary-400 font-semibold">
                                                ₹{result.simulatedSalary.toLocaleString()}
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className={result.difference >= 0 ? 'text-green-400' : 'text-red-400'}>
                                                    {result.difference >= 0 ? '+' : ''}₹{result.difference.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {result.difference >= 0 ? (
                                                        <TrendingUp className="w-4 h-4 text-green-400" />
                                                    ) : (
                                                        <AlertTriangle className="w-4 h-4 text-red-400" />
                                                    )}
                                                    <span className="text-white">{result.percentChange}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-6 border-t border-dark-border bg-dark-surface">
                            <div className="flex items-center gap-3">
                                <CheckCircle className="w-5 h-5 text-green-400" />
                                <div className="text-white font-semibold">Simulation Complete</div>
                                <div className="text-dark-muted text-sm">
                                    • Review results above • If satisfied, proceed to finalize payroll
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
